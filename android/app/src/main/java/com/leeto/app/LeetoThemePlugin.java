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
        ret.put("primary", color(android.R.color.system_accent1_400, dark ? android.R.color.system_accent1_200 : android.R.color.system_accent1_600));
        ret.put("onPrimary", dark ? "#1C1B1F" : "#FFFFFF");
        ret.put("surface", color(android.R.color.system_neutral1_900, dark ? android.R.color.system_neutral1_900 : android.R.color.system_neutral1_10));
        ret.put("onSurface", color(android.R.color.system_neutral1_10, dark ? android.R.color.system_neutral1_10 : android.R.color.system_neutral1_900));
        ret.put("surfaceContainer", color(android.R.color.system_neutral2_800, dark ? android.R.color.system_neutral2_800 : android.R.color.system_neutral2_50));
        ret.put("outline", color(android.R.color.system_neutral2_400, dark ? android.R.color.system_neutral2_400 : android.R.color.system_neutral2_500));
        ret.put("accent", color(android.R.color.system_accent2_400, dark ? android.R.color.system_accent2_200 : android.R.color.system_accent2_600));
        return ret;
    }

    private String color(int darkRes, int lightRes) {
        int res = (getContext().getResources().getConfiguration().uiMode
                & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES ? darkRes : lightRes;
        int c = getContext().getColor(res);
        return String.format("#%06X", (0xFFFFFF & c));
    }

    private String color(int res, int fallbackRes) {
        try {
            int c = getContext().getColor(res);
            return String.format("#%06X", (0xFFFFFF & c));
        } catch (Exception e) {
            int c = getContext().getColor(fallbackRes);
            return String.format("#%06X", (0xFFFFFF & c));
        }
    }
}
