package com.leeto.app;

import android.content.Context;
import android.content.Intent;
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

/** Motor de voz compartido por el plugin y el servicio en primer plano. */
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
    private Context app;
    private TextToSpeech tts;
    private Listener listener;
    private String title = "Leeto";
    private String subtitle = "";
    private int index = 0;
    private int utteranceSerial = 0;
    private boolean initialized = false;
    private boolean playing = false;
    private float rate = 1.0f;
    private Locale locale = new Locale("es", "ES");

    static LeetoAudioEngine get() {
        return INSTANCE;
    }

    private LeetoAudioEngine() {}

    void init(Context context) {
        if (app != null) return;
        app = context.getApplicationContext();
        tts =
                new TextToSpeech(
                        app,
                        status -> {
                            initialized = status == TextToSpeech.SUCCESS;
                            if (initialized && tts.setLanguage(locale) < 0) {
                                initialized = tts.setLanguage(Locale.getDefault()) >= 0;
                            }
                            if (!initialized) emitError("Voz no disponible en este dispositivo");
                        });
        tts.setOnUtteranceProgressListener(
                new UtteranceProgressListener() {
                    @Override
                    public void onStart(String utteranceId) {
                        playing = true;
                        emitState("playing");
                    }

                    @Override
                    public void onDone(String utteranceId) {
                        main.post(
                                () -> {
                                    if (index + 1 < chunks.size()) {
                                        index += 1;
                                        speakCurrent();
                                    } else {
                                        playing = false;
                                        emitState("ended");
                                        stopForeground();
                                    }
                                });
                    }

                    @Override
                    public void onError(String utteranceId) {
                        main.post(
                                () -> {
                                    playing = false;
                                    emitError("No se pudo reproducir el fragmento");
                                    emitState("error");
                                    stopForeground();
                                });
                    }

                    @Override
                    public void onRangeStart(String utteranceId, int start, int end, int frame) {
                        String text = currentText();
                        if (text == null) return;
                        int word = 0;
                        for (int i = 0; i < start && i < text.length(); i++) {
                            if (Character.isWhitespace(text.charAt(i))) word += 1;
                        }
                        int finalWord = word;
                        int finalClip = clipIndexAt(index);
                        main.post(() -> notifyListener(l -> l.onBoundary(finalClip, finalWord)));
                    }
                });
    }

    void setListener(Listener value) {
        listener = value;
    }

    void configure(
            List<String> texts,
            List<Integer> indices,
            String bookTitle,
            String chapterTitle,
            int startIndex,
            float speed,
            String language) {
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
        if (initialized) tts.setLanguage(locale);
        index = chunkIndexFor(startIndex);
        LeetoAudioService.refresh();
    }

    void play(int position) {
        index = chunkIndexFor(position);
        startForeground();
        speakCurrent();
    }

    void resume() {
        if (!playing) speakCurrent();
    }

    void pause() {
        if (tts != null) tts.stop();
        playing = false;
        emitState("paused");
        LeetoAudioService.refresh();
    }

    void next() {
        if (index + 1 >= chunks.size()) {
            stop();
            return;
        }
        index += 1;
        startForeground();
        speakCurrent();
    }

    void previous() {
        if (index <= 0) return;
        index -= 1;
        startForeground();
        speakCurrent();
    }

    void stop() {
        if (tts != null) tts.stop();
        playing = false;
        emitState("stopped");
        stopForeground();
    }

    void destroy() {
        if (tts != null) {
            tts.stop();
            tts.shutdown();
            tts = null;
        }
        initialized = false;
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

    boolean isPlaying() {
        return playing;
    }

    float getRate() {
        return rate;
    }

    private String currentText() {
        return index >= 0 && index < chunks.size() ? chunks.get(index) : null;
    }

    private int chunkIndexFor(int clipIndex) {
        if (chunks.isEmpty()) return 0;
        for (int i = 0; i < clipIndices.size(); i++) {
            if (clipIndices.get(i) >= clipIndex) return i;
        }
        return chunks.size() - 1;
    }

    private int clipIndexAt(int chunkIndex) {
        return chunkIndex >= 0 && chunkIndex < clipIndices.size()
                ? clipIndices.get(chunkIndex)
                : chunkIndex;
    }

    private void speakCurrent() {
        String text = currentText();
        if (text == null || tts == null) {
            emitState("ended");
            stopForeground();
            return;
        }
        Bundle params = new Bundle();
        params.putFloat("rate", rate);
        utteranceSerial += 1;
        tts.speak(text, TextToSpeech.QUEUE_FLUSH, params, "leeto_" + utteranceSerial);
        LeetoAudioService.refresh();
    }

    private void startForeground() {
        if (app == null) return;
        Intent intent = new Intent(app, LeetoAudioService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            app.startForegroundService(intent);
        } else {
            app.startService(intent);
        }
    }

    private void stopForeground() {
        if (app != null) app.stopService(new Intent(app, LeetoAudioService.class));
        LeetoAudioService.refresh();
    }

    private void emitState(String status) {
        LeetoAudioService.refresh();
        notifyListener(l -> l.onState(status, clipIndexAt(index), chunks.size()));
    }

    private void emitError(String message) {
        notifyListener(l -> l.onError(message));
    }

    private void notifyListener(java.util.function.Consumer<Listener> action) {
        if (listener == null) return;
        main.post(() -> action.accept(listener));
    }
}
