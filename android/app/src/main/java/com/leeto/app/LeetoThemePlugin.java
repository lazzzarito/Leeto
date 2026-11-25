package com.leeto.app;

import android.content.res.Configuration;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "LeetoTheme")
public class LeetoThemePlugin extends Plugin {
    @PluginMethod
    public void getPalette(PluginCall call) {
        call.resolve(buildPalette());
    }

    @Override
    public void handleOnConfigurationChanged(Configuration newConfig) {
        super.handleOnConfigurationChanged(newConfig);
        notifyListeners("paletteChanged", buildPalette());
    }

    private JSObject buildPalette() {
        JSObject ret = new JSObject();
        boolean dark = (getContext().getResources().getConfiguration().uiMode
                & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
        ret.put("dark", dark);
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
            ret.put("available", false);
            return ret;
        }
        ret.put("available", true);
        ret.put("primary", color(dark ? android.R.color.system_accent1_200 : android.R.color.system_accent1_600));
        ret.put("onPrimary", dark ? "#1C1B1F" : "#FFFFFF");
        ret.put("surface", color(dark ? android.R.color.system_neutral1_900 : android.R.color.system_neutral1_10));
        ret.put("onSurface", color(dark ? android.R.color.system_neutral1_10 : android.R.color.system_neutral1_900));
        ret.put("surfaceContainer", color(dark ? android.R.color.system_neutral2_800 : android.R.color.system_neutral2_50));
        ret.put("outline", color(dark ? android.R.color.system_neutral2_400 : android.R.color.system_neutral2_500));
        ret.put("accent", color(dark ? android.R.color.system_accent2_200 : android.R.color.system_accent2_600));
        return ret;
    }

    private String color(int res) {
        return String.format("#%06X", (0xFFFFFF & getContext().getColor(res)));
    }
}
