package com.leeto.app;

import android.Manifest;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import java.util.ArrayList;
import java.util.List;

/** Puente entre el reproductor web y el servicio nativo de audio. */
@CapacitorPlugin(
        name = "LeetoAudio",
        permissions =
                @Permission(
                        alias = "notifications",
                        strings = {Manifest.permission.POST_NOTIFICATIONS}))
public class LeetoAudioPlugin extends Plugin {
    @Override
    public void load() {
        LeetoAudioEngine.get().init(getContext());
        LeetoAudioEngine.get().setListener(
                        new LeetoAudioEngine.Listener() {
                            @Override
                            public void onState(String status, int index, int count) {
                                JSObject data = new JSObject();
                                data.put("status", status);
                                data.put("index", index);
                                data.put("count", count);
                                notifyListeners("stateChanged", data);
                            }

                            @Override
                            public void onBoundary(int index, int wordIndex) {
                                JSObject data = new JSObject();
                                data.put("index", index);
                                data.put("wordIndex", wordIndex);
                                notifyListeners("boundary", data);
                            }

                            @Override
                            public void onError(String message) {
                                JSObject data = new JSObject();
                                data.put("message", message);
                                notifyListeners("error", data);
                            }
                        });
        super.load();
    }

    @Override
    protected void handleOnDestroy() {
        LeetoAudioEngine.get().setListener(null);
        super.handleOnDestroy();
    }

    @PluginMethod
    public void configure(PluginCall call) {
        JSArray raw = call.getArray("chunks", new JSArray());
        JSArray rawIndices = call.getArray("clipIndices", new JSArray());
        List<String> chunks = new ArrayList<>();
        List<Integer> indices = new ArrayList<>();
        for (int i = 0; i < raw.length(); i++) {
            chunks.add(raw.optString(i));
            indices.add(rawIndices.optInt(i, i));
        }
        LeetoAudioEngine.get()
                .configure(
                        chunks,
                        indices,
                        call.getString("title"),
                        call.getString("subtitle"),
                        call.getInt("index", 0),
                        call.getDouble("rate", 1.0).floatValue(),
                        call.getString("lang"));
        call.resolve();
    }

    @PluginMethod
    public void play(PluginCall call) {
        LeetoAudioEngine.get().play(call.getInt("index", 0));
        call.resolve();
    }

    @PluginMethod
    public void pause(PluginCall call) {
        LeetoAudioEngine.get().pause();
        call.resolve();
    }

    @PluginMethod
    public void resume(PluginCall call) {
        LeetoAudioEngine.get().resume();
        call.resolve();
    }

    @PluginMethod
    public void stop(PluginCall call) {
        LeetoAudioEngine.get().stop();
        call.resolve();
    }

    @PluginMethod
    public void next(PluginCall call) {
        LeetoAudioEngine.get().next();
        call.resolve();
    }

    @PluginMethod
    public void previous(PluginCall call) {
        LeetoAudioEngine.get().previous();
        call.resolve();
    }
}
