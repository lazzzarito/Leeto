package com.leeto.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(LeetoAudioPlugin.class);
        registerPlugin(LeetoThemePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
