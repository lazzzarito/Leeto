package com.leeto.app;

import android.content.Intent;
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

        // El gesto del sistema debe seguir las mismas reglas que los botones de
        // la app: cerrar diálogos, volver de la lectura o salir en la biblioteca.
        getOnBackPressedDispatcher()
                .addCallback(
                        this,
                        new OnBackPressedCallback(true) {
                            @Override
                            public void handleOnBackPressed() {
                                WebView webView = bridge == null ? null : bridge.getWebView();
                                if (webView == null) {
                                    exitApp();
                                    return;
                                }
                                webView.evaluateJavascript(
                                        "(function(){"
                                                + "if(typeof window.leetoHandleBack!=='function') return 'missing';"
                                                + "return window.leetoHandleBack() ? 'handled' : 'unhandled';"
                                                + "})()",
                                        value -> {
                                            if ("handled".equals(value)) return;
                                            // JS todavía no arrancó: el WebView sí puede tener
                                            // una entrada propia que sea seguro consumir.
                                            if ("missing".equals(value) && canPopWebView(webView)) {
                                                webView.goBack();
                                                return;
                                            }
                                            exitApp();
                                        });
                            }

                            private void exitApp() {
                                setEnabled(false);
                                getOnBackPressedDispatcher().onBackPressed();
                                setEnabled(true);
                            }
                        });
        routeNotificationBook(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        routeNotificationBook(intent);
    }

    /** La notificación abre el libro que suena, incluso tras recrear la Activity. */
    private void routeNotificationBook(Intent intent) {
        String bookId = intent == null ? null : intent.getStringExtra(LeetoAudioService.EXTRA_BOOK_ID);
        if (bookId == null) return;
        // Los ids se generan en la app; sanitizar evita inyectar JS si llega un intent externo.
        bookId = bookId.replaceAll("[^A-Za-z0-9_-]", "");
        if (bookId.isEmpty()) return;
        String target = "/read/" + bookId;
        WebView webView = bridge == null ? null : bridge.getWebView();
        if (webView == null) return;
        webView.post(
                () -> {
                    String url = webView.getUrl();
                    if (url != null && url.contains(target)) return;
                    webView.evaluateJavascript(
                            "window.location.assign('" + target + "')", null);
                });
    }

    private boolean canPopWebView(WebView webView) {
        String url = webView.getUrl();
        return webView.canGoBack()
                && url != null
                && (url.startsWith("http://localhost") || url.startsWith("https://localhost"));
    }
}
