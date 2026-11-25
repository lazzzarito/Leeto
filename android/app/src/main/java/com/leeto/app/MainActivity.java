package com.leeto.app;

import android.os.Bundle;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(LeetoAudioPlugin.class);
        registerPlugin(LeetoThemePlugin.class);
        super.onCreate(savedInstanceState);

        // El botón del lector es una navegación web, pero el gesto del sistema
        // llegaba a la Activity y la cerraba: nadie consumía el back nativo.
        getOnBackPressedDispatcher()
                .addCallback(
                        this,
                        new OnBackPressedCallback(true) {
                            @Override
                            public void handleOnBackPressed() {
                                WebView webView = bridge == null ? null : bridge.getWebView();
                                if (canPopWebView(webView)) {
                                    webView.goBack();
                                    return;
                                }
                                // Sin historial interno: dejamos que el sistema cierre la app.
                                setEnabled(false);
                                getOnBackPressedDispatcher().onBackPressed();
                                setEnabled(true);
                            }
                        });
    }

    private boolean canPopWebView(WebView webView) {
        if (webView == null || !webView.canGoBack()) return false;
        String url = webView.getUrl();
        return url != null
                && (url.startsWith("http://localhost") || url.startsWith("https://localhost"));
    }
}
