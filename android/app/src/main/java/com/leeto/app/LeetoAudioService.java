package com.leeto.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.media.session.MediaSession;
import android.media.session.PlaybackState;
import android.os.Build;
import android.os.Bundle;
import android.os.IBinder;

import androidx.annotation.Nullable;

/** Servicio en primer plano: notificación MediaStyle y MediaSession del sistema. */
public class LeetoAudioService extends Service {
    static final String ACTION_PLAY = "com.leeto.app.PLAY";
    static final String ACTION_PAUSE = "com.leeto.app.PAUSE";
    static final String ACTION_NEXT = "com.leeto.app.NEXT";
    static final String ACTION_PREV = "com.leeto.app.PREV";
    static final String ACTION_STOP = "com.leeto.app.STOP";

    private static final String CHANNEL_ID = "leeto_audio";
    private static final int NOTIFICATION_ID = 1001;

    private static LeetoAudioService instance;
    private MediaSession session;

    static void refresh() {
        if (instance != null) instance.sync();
    }

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        createChannel();
        session = new MediaSession(this, "LeetoAudio");
        session.setFlags(
                MediaSession.FLAG_HANDLES_MEDIA_BUTTONS | MediaSession.FLAG_HANDLES_TRANSPORT_CONTROLS);
        session.setCallback(
                new MediaSession.Callback() {
                    @Override
                    public void onPlay() {
                        LeetoAudioEngine.get().resume();
                    }

                    @Override
                    public void onPause() {
                        LeetoAudioEngine.get().pause();
                    }

                    @Override
                    public void onSkipToNext() {
                        LeetoAudioEngine.get().next();
                    }

                    @Override
                    public void onSkipToPrevious() {
                        LeetoAudioEngine.get().previous();
                    }

                    @Override
                    public void onStop() {
                        LeetoAudioEngine.get().stop();
                        stopSelf();
                    }
                });
        session.setActive(true);
        sync();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent == null ? null : intent.getAction();
        LeetoAudioEngine engine = LeetoAudioEngine.get();
        if (ACTION_STOP.equals(action)) {
            engine.stop();
            stopSelf();
            return START_NOT_STICKY;
        }
        if (ACTION_NEXT.equals(action)) engine.next();
        if (ACTION_PREV.equals(action)) engine.previous();
        if (ACTION_PAUSE.equals(action)) engine.pause();
        if (ACTION_PLAY.equals(action)) engine.resume();
        startForeground(NOTIFICATION_ID, buildNotification());
        return START_STICKY;
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        instance = null;
        if (session != null) {
            session.setActive(false);
            session.release();
            session = null;
        }
        super.onDestroy();
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel channel =
                new NotificationChannel(CHANNEL_ID, "Reproducción de audio", NotificationManager.IMPORTANCE_LOW);
        channel.setDescription("Controles del lector de Leeto");
        channel.setSound(null, null);
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) manager.createNotificationChannel(channel);
    }

    private void sync() {
        if (session == null) return;
        LeetoAudioEngine engine = LeetoAudioEngine.get();
        Bundle extras = new Bundle();
        extras.putInt("index", engine.getIndex());
        extras.putInt("count", engine.getCount());
        PlaybackState state =
                new PlaybackState.Builder()
                        .setActions(
                                PlaybackState.ACTION_PLAY
                                        | PlaybackState.ACTION_PAUSE
                                        | PlaybackState.ACTION_SKIP_TO_NEXT
                                        | PlaybackState.ACTION_SKIP_TO_PREVIOUS
                                        | PlaybackState.ACTION_STOP)
                        .setState(
                                engine.isPlaying() ? PlaybackState.STATE_PLAYING : PlaybackState.STATE_PAUSED,
                                0,
                                engine.getRate())
                        .setExtras(extras)
                        .build();
        session.setPlaybackState(state);
        session.setMetadata(
                new android.media.MediaMetadata.Builder()
                        .putString(android.media.MediaMetadata.METADATA_KEY_TITLE, engine.getTitle())
                        .putString(android.media.MediaMetadata.METADATA_KEY_ARTIST, engine.getSubtitle())
                        .build());
        NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) manager.notify(NOTIFICATION_ID, buildNotification());
    }

    private Notification buildNotification() {
        LeetoAudioEngine engine = LeetoAudioEngine.get();
        Notification.Builder builder =
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                        ? new Notification.Builder(this, CHANNEL_ID)
                        : new Notification.Builder(this);
        String position =
                engine.getCount() > 0
                        ? (engine.getIndex() + 1) + "/" + engine.getCount()
                        : "";
        String text =
                engine.getSubtitle().isEmpty()
                        ? position
                        : engine.getSubtitle() + (position.isEmpty() ? "" : " · " + position);

        builder.setSmallIcon(R.drawable.ic_stat_audio)
                .setContentTitle(engine.getTitle())
                .setContentText(text)
                .setOnlyAlertOnce(true)
                .setOngoing(engine.isPlaying())
                .setContentIntent(
                        PendingIntent.getActivity(
                                this,
                                0,
                                new Intent(this, MainActivity.class),
                                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE))
                .setDeleteIntent(actionIntent(ACTION_STOP, 4))
                .addAction(R.drawable.ic_prev, "Anterior", actionIntent(ACTION_PREV, 1))
                .addAction(
                        engine.isPlaying() ? R.drawable.ic_pause : R.drawable.ic_play,
                        engine.isPlaying() ? "Pausar" : "Reproducir",
                        actionIntent(engine.isPlaying() ? ACTION_PAUSE : ACTION_PLAY, 2))
                .addAction(R.drawable.ic_next, "Siguiente", actionIntent(ACTION_NEXT, 3));

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            Notification.MediaStyle style = new Notification.MediaStyle();
            if (session != null) style.setMediaSession(session.getSessionToken());
            style.setShowActionsInCompactView(0, 1, 2);
            builder.setStyle(style);
        }
        return builder.build();
    }

    private PendingIntent actionIntent(String action, int requestCode) {
        Intent intent = new Intent(this, LeetoAudioService.class).setAction(action);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags |= PendingIntent.FLAG_IMMUTABLE;
        return PendingIntent.getService(this, requestCode, intent, flags);
    }
}
