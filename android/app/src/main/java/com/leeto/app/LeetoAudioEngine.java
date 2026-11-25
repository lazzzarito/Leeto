package com.leeto.app;

import android.content.Context;
import android.content.Intent;
import android.media.AudioManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;

/**
 * Motor de voz compartido por el plugin y el servicio en primer plano.
 *
 * <p>Todo el estado mutable se lee y se escribe en el hilo principal: los métodos públicos y los
 * callbacks de TextToSpeech publican allí sus cambios. Así no hay carreras entre el hilo de
 * Capacitor, los hilos binder de TTS y MediaSession. Los callbacks de utterances antiguas se
 * ignoran comparando su identificador, de modo que un QUEUE_FLUSH no detenga el servicio.
 */
final class LeetoAudioEngine {
    private static final LeetoAudioEngine INSTANCE = new LeetoAudioEngine();

    interface Listener {
        void onState(String status, int index, int count);

        void onBoundary(int index, int wordIndex);

        void onError(String message);
    }

    private final Handler main = new Handler(Looper.getMainLooper());
    private final List<String> chunks = new ArrayList<>();
    private final List<Integer> clipIndices = new ArrayList<>();
    private final HashMap<String, String> utteranceParams = new HashMap<>();
    private final AudioManager.OnAudioFocusChangeListener focusListener = focusChange -> { };

    private Context app;
    private TextToSpeech tts;
    private Listener listener;
    private String title = "Leeto";
    private String subtitle = "";
    private int index = 0;
    private String utteranceId;
    private int utteranceSerial = 0;
    private volatile boolean initialized = false;
    private volatile boolean playing = false;
    private volatile boolean foregroundActive = false;
    private boolean audioFocusRequested = false;
    private float rate = 1.0f;
    private Locale locale = new Locale("es", "ES");

    static LeetoAudioEngine get() {
        return INSTANCE;
    }

    private LeetoAudioEngine() {}

    void init(Context context) {
        main.post(
                () -> {
                    if (app == null) app = context.getApplicationContext();
                    if (tts != null) return;
                    final TextToSpeech[] holder = new TextToSpeech[1];
                    holder[0] =
                            new TextToSpeech(
                                    app,
                                    status ->
                                            main.post(
                                                    () -> {
                                                        TextToSpeech active = holder[0];
                                                        if (tts != active) return;
                                                        initialized = status == TextToSpeech.SUCCESS;
                                                        if (initialized && active.setLanguage(locale) < 0) {
                                                            initialized =
                                                                    active.setLanguage(Locale.getDefault())
                                                                            >= 0;
                                                        }
                                                        if (!initialized) {
                                                            emitError("Voz no disponible en este dispositivo");
                                                        }
                                                    }));
                    tts = holder[0];
                    tts.setOnUtteranceProgressListener(
                            new UtteranceProgressListener() {
                                @Override
                                public void onStart(String id) {
                                    main.post(
                                            () -> {
                                                if (!isCurrent(id)) return;
                                                playing = true;
                                                emitState("playing");
                                            });
                                }

                                @Override
                                public void onDone(String id) {
                                    main.post(
                                            () -> {
                                                if (!isCurrent(id)) return;
                                                if (index + 1 < chunks.size()) {
                                                    index += 1;
                                                    speakCurrent();
                                                } else {
                                                    playing = false;
                                                    utteranceId = null;
                                                    emitState("ended");
                                                    stopForeground();
                                                }
                                            });
                                }

                                @Override
                                public void onError(String id) {
                                    main.post(
                                            () -> {
                                                if (!isCurrent(id)) return;
                                                playing = false;
                                                utteranceId = null;
                                                emitError("No se pudo reproducir el fragmento");
                                                emitState("error");
                                                // La notificación permanece visible en estado pausado:
                                                // ocultarla aquí era lo que la hacía parpadear.
                                                LeetoAudioService.refresh();
                                            });
                                }

                                @Override
                                public void onError(String id, int errorCode) {
                                    onError(id);
                                }

                                @Override
                                public void onRangeStart(String id, int start, int end, int frame) {
                                    main.post(
                                            () -> {
                                                if (!isCurrent(id)) return;
                                                String text = currentText();
                                                if (text == null) return;
                                                int word = 0;
                                                for (int i = 0; i < start && i < text.length(); i++) {
                                                    if (Character.isWhitespace(text.charAt(i))) word += 1;
                                                }
                                                int finalWord = word;
                                                int finalClip = clipIndexAt(index);
                                                notifyListener(l -> l.onBoundary(finalClip, finalWord));
                                            });
                                }
                            });
                });
    }

    void setListener(Listener value) {
        main.post(() -> listener = value);
    }

    /** La Activity se destruye, pero el servicio puede seguir leyendo: no tocamos el TTS. */
    void onHostDestroyed() {
        main.post(() -> listener = null);
    }

    void configure(
            List<String> texts,
            List<Integer> indices,
            String bookTitle,
            String chapterTitle,
            int startIndex,
            float speed,
            String language) {
        main.post(
                () -> {
                    chunks.clear();
                    clipIndices.clear();
                    for (int i = 0; i < texts.size(); i++) {
                        String text = texts.get(i);
                        if (text == null || text.trim().isEmpty()) continue;
                        chunks.add(text);
                        clipIndices.add(i < indices.size() ? indices.get(i) : i);
                    }
                    title = bookTitle == null || bookTitle.isEmpty() ? "Leeto" : bookTitle;
                    subtitle = chapterTitle == null ? "" : chapterTitle;
                    rate = speed > 0 ? speed : 1.0f;
                    if (language != null && !language.isEmpty()) {
                        locale = new Locale(language.split("-")[0]);
                    }
                    if (initialized && tts != null) tts.setLanguage(locale);
                    index = chunkIndexFor(startIndex);
                    LeetoAudioService.refresh();
                });
    }

    void play(int position) {
        main.post(
                () -> {
                    index = chunkIndexFor(position);
                    startForeground();
                    speakCurrent();
                });
    }

    void resume() {
        main.post(
                () -> {
                    if (playing) return;
                    startForeground();
                    speakCurrent();
                });
    }

    void pause() {
        main.post(
                () -> {
                    if (tts != null) tts.stop();
                    playing = false;
                    utteranceId = null;
                    emitState("paused");
                    LeetoAudioService.refresh();
                });
    }

    void next() {
        main.post(
                () -> {
                    if (index + 1 >= chunks.size()) {
                        stop();
                        return;
                    }
                    index += 1;
                    startForeground();
                    speakCurrent();
                });
    }

    void previous() {
        main.post(
                () -> {
                    if (index <= 0) return;
                    index -= 1;
                    startForeground();
                    speakCurrent();
                });
    }

    void stop() {
        main.post(
                () -> {
                    if (tts != null) tts.stop();
                    playing = false;
                    utteranceId = null;
                    emitState("stopped");
                    stopForeground();
                });
    }

    /** El servicio ya se ha detenido: solo ajustamos nuestro indicador local. */
    void onServiceStopped() {
        main.post(
                () -> {
                    foregroundActive = false;
                    abandonAudioFocus();
                });
    }

    boolean isPlaying() {
        return playing;
    }

    String getTitle() {
        return title;
    }

    String getSubtitle() {
        return subtitle;
    }

    int getIndex() {
        return index;
    }

    int getCount() {
        return chunks.size();
    }

    float getRate() {
        return rate;
    }

    private boolean isCurrent(String id) {
        return id != null && id.equals(utteranceId);
    }

    /** Solo se llama desde el hilo principal. */
    private void speakCurrent() {
        TextToSpeech engine = tts;
        if (engine == null || index < 0 || index >= chunks.size()) return;
        utteranceId = "leeto-" + (++utteranceSerial);
        utteranceParams.put(TextToSpeech.Engine.KEY_PARAM_UTTERANCE_ID, utteranceId);
        playing = true;
        engine.speak(chunks.get(index), TextToSpeech.QUEUE_FLUSH, utteranceParams);
        LeetoAudioService.refresh();
    }

    /** Solo se llama desde el hilo principal; iniciar dos veces provocaba el parpadeo. */
    private void startForeground() {
        if (foregroundActive || app == null) return;
        Intent intent = new Intent(app, LeetoAudioService.class);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                app.startForegroundService(intent);
            } else {
                app.startService(intent);
            }
            foregroundActive = true;
            requestAudioFocus();
        } catch (IllegalStateException | SecurityException ignored) {
            // Android 12+ puede prohibir iniciar el servicio desde segundo plano.
            // La lectura continúa; perdemos la notificación, pero no la app.
            foregroundActive = false;
        }
    }

    private void stopForeground() {
        if (app == null) return;
        foregroundActive = false;
        abandonAudioFocus();
        app.stopService(new Intent(app, LeetoAudioService.class));
    }

    private void requestAudioFocus() {
        if (audioFocusRequested || app == null) return;
        AudioManager manager = (AudioManager) app.getSystemService(Context.AUDIO_SERVICE);
        if (manager == null) return;
        try {
            int result =
                    manager.requestAudioFocus(
                            focusListener, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN);
            audioFocusRequested = result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED;
        } catch (RuntimeException ignored) {
            audioFocusRequested = false;
        }
    }

    private void abandonAudioFocus() {
        if (!audioFocusRequested || app == null) return;
        AudioManager manager = (AudioManager) app.getSystemService(Context.AUDIO_SERVICE);
        if (manager == null) return;
        try {
            manager.abandonAudioFocus(focusListener);
        } catch (RuntimeException ignored) {
            // No hay nada más que hacer si el sistema ya liberó el foco.
        }
        audioFocusRequested = false;
    }

    private String currentText() {
        return index >= 0 && index < chunks.size() ? chunks.get(index) : null;
    }

    private int chunkIndexFor(int clipIndex) {
        for (int i = 0; i < clipIndices.size(); i++) {
            if (clipIndices.get(i) == clipIndex) return i;
        }
        return 0;
    }

    private int clipIndexAt(int chunkIndex) {
        return chunkIndex >= 0 && chunkIndex < clipIndices.size() ? clipIndices.get(chunkIndex) : 0;
    }

    private void emitState(String status) {
        LeetoAudioService.refresh();
        notifyListener(l -> l.onState(status, clipIndexAt(index), chunks.size()));
    }

    private void emitError(String message) {
        notifyListener(l -> l.onError(message));
    }

    private void notifyListener(java.util.function.Consumer<Listener> action) {
        final Listener target = listener;
        if (target == null) return;
        main.post(
                () -> {
                    // Un evento en cola no debe llegar a un listener ya sustituido.
                    if (listener != target) return;
                    action.accept(target);
                });
    }
}
