package com.leeto.app;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import androidx.documentfile.provider.DocumentFile;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

/**
 * Selección de carpetas en Android mediante Storage Access Framework.
 * Android WebView no soporta de forma fiable {@code <input webkitdirectory>} ni
 * File System Access, así que leemos la carpeta elegida por el usuario y
 * devolvemos los libros compatibles al WebView.
 */
@CapacitorPlugin(name = "LeetoFolder")
public class LeetoFolderPlugin extends Plugin {
    private static final int MAX_DEPTH = 8;
    private static final int BUFFER_SIZE = 8192;

    @PluginMethod
    public void pickFolder(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        intent.addFlags(Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
        intent.addFlags(Intent.FLAG_GRANT_PREFIX_URI_PERMISSION);
        startActivityForResult(call, intent, "handlePickFolder");
    }

    @ActivityCallback
    private void handlePickFolder(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            call.resolve(new JSObject().put("cancelled", true));
            return;
        }

        Uri uri = result.getData().getData();
        if (uri == null) {
            call.resolve(new JSObject().put("cancelled", true));
            return;
        }

        Set<String> extensions = extensionsFromCall(call);
        try {
            final Uri treeUri = uri;
            getActivity()
                    .runOnUiThread(
                            () -> {
                                // La lectura puede tardar en carpetas grandes; la hacemos fuera del
                                // callback de resultado para no bloquear la UI más de lo necesario.
                                new Thread(
                                                () -> {
                                                    try {
                                                        JSArray files = collectFiles(treeUri, extensions);
                                                        JSObject ret = new JSObject();
                                                        ret.put("cancelled", false);
                                                        ret.put("files", files);
                                                        call.resolve(ret);
                                                    } catch (Exception e) {
                                                        call.reject("No se pudo leer la carpeta: " + e.getMessage());
                                                    }
                                                },
                                                "leeto-folder-import")
                                        .start();
                            });
        } catch (Exception e) {
            call.reject("No se pudo leer la carpeta: " + e.getMessage());
        }
    }

    private JSArray collectFiles(Uri treeUri, Set<String> extensions) throws Exception {
        DocumentFile root = DocumentFile.fromTreeUri(getContext(), treeUri);
        if (root == null || !root.isDirectory()) {
            throw new IllegalStateException("La carpeta seleccionada no está disponible");
        }
        JSArray files = new JSArray();
        walk(root, root.getName() == null ? "" : root.getName(), 0, extensions, files);
        return files;
    }

    private void walk(DocumentFile dir, String prefix, int depth, Set<String> extensions, JSArray files)
            throws Exception {
        if (depth > MAX_DEPTH) return;
        DocumentFile[] children = dir.listFiles();
        if (children == null) return;
        for (DocumentFile child : children) {
            String name = child.getName();
            if (name == null) continue;
            String path = prefix.isEmpty() ? name : prefix + "/" + name;
            if (child.isDirectory()) {
                walk(child, path, depth + 1, extensions, files);
            } else if (child.isFile() && isSupported(name, extensions)) {
                JSObject file = readFile(child, path, name);
                if (file != null) files.put(file);
            }
        }
    }

    private JSObject readFile(DocumentFile file, String path, String name) throws Exception {
        Uri uri = file.getUri();
        try (InputStream input = getContext().getContentResolver().openInputStream(uri)) {
            if (input == null) return null;
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            byte[] buffer = new byte[BUFFER_SIZE];
            int read;
            while ((read = input.read(buffer)) != -1) {
                output.write(buffer, 0, read);
            }
            byte[] bytes = output.toByteArray();
            JSObject ret = new JSObject();
            ret.put("name", name);
            ret.put("path", path);
            ret.put("mimeType", file.getType() == null ? "" : file.getType());
            ret.put("size", bytes.length);
            ret.put("dataBase64", Base64.encodeToString(bytes, Base64.NO_WRAP));
            return ret;
        }
    }

    private boolean isSupported(String name, Set<String> extensions) {
        int dot = name.lastIndexOf('.');
        if (dot < 0 || dot == name.length() - 1) return false;
        String ext = name.substring(dot + 1).toLowerCase(Locale.ROOT);
        return extensions.contains(ext);
    }

    private Set<String> extensionsFromCall(PluginCall call) {
        Set<String> extensions = new HashSet<>();
        JSArray raw = call.getArray("extensions");
        if (raw != null) {
            for (int i = 0; i < raw.length(); i++) {
                String ext = raw.optString(i, "").toLowerCase(Locale.ROOT).trim();
                if (!ext.isEmpty()) extensions.add(ext.replaceFirst("^\\.", ""));
            }
        }
        if (extensions.isEmpty()) {
            // Fallback defensivo: mismo conjunto que la web.
            String[] defaults = {"epub", "pdf", "txt", "md", "markdown", "html", "htm", "fb2", "docx", "odt", "cbz"};
            for (String ext : defaults) extensions.add(ext);
        }
        return extensions;
    }
}