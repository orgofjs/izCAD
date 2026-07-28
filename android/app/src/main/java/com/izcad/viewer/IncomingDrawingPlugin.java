package com.izcad.viewer;

import android.content.ClipData;
import android.content.ContentResolver;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Parcelable;
import android.provider.OpenableColumns;
import androidx.annotation.Nullable;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.Locale;
import org.json.JSONObject;

@CapacitorPlugin(name = "IncomingDrawing")
public class IncomingDrawingPlugin extends Plugin {

    private final Object pendingLock = new Object();
    private JSObject pendingDrawing;
    private long nextDrawingId = 1;

    @Override
    protected void handleOnNewIntent(Intent intent) {
        Uri uri = getDrawingUri(intent);
        if (uri == null || !isLocalUri(uri)) {
            return;
        }

        ContentResolver resolver = getContext().getContentResolver();
        String mimeType = intent.getType();
        if (mimeType == null || mimeType.trim().isEmpty()) {
            try {
                mimeType = resolver.getType(uri);
            } catch (RuntimeException ignored) {
                mimeType = null;
            }
        }

        DrawingMetadata metadata = readMetadata(resolver, uri);
        String name = normalizeName(metadata.name, uri, mimeType);
        String id;
        synchronized (pendingLock) {
            id = Long.toString(nextDrawingId++);
            pendingDrawing = new JSObject();
            pendingDrawing.put("id", id);
            pendingDrawing.put("uri", uri.toString());
            pendingDrawing.put("name", name);
            pendingDrawing.put("mimeType", mimeType == null ? "" : mimeType);
            pendingDrawing.put("size", metadata.size);
        }

        notifyListeners("drawingReceived", pendingDrawing, true);
    }

    @PluginMethod
    public void getPendingDrawing(PluginCall call) {
        JSObject result = new JSObject();
        synchronized (pendingLock) {
            result.put(
                "drawing",
                pendingDrawing == null ? JSONObject.NULL : pendingDrawing
            );
        }
        call.resolve(result);
    }

    @PluginMethod
    public void acknowledgeDrawing(PluginCall call) {
        String id = call.getString("id");
        boolean acknowledged = false;

        synchronized (pendingLock) {
            if (
                pendingDrawing != null &&
                id != null &&
                id.equals(pendingDrawing.getString("id"))
            ) {
                pendingDrawing = null;
                acknowledged = true;
            }
        }

        JSObject result = new JSObject();
        result.put("acknowledged", acknowledged);
        call.resolve(result);
    }

    @Nullable
    private Uri getDrawingUri(Intent intent) {
        if (intent == null) {
            return null;
        }

        String action = intent.getAction();
        if (Intent.ACTION_VIEW.equals(action)) {
            Uri data = intent.getData();
            return data == null ? getFirstClipDataUri(intent) : data;
        }

        if (!Intent.ACTION_SEND.equals(action)) {
            return null;
        }

        Parcelable stream = intent.getParcelableExtra(Intent.EXTRA_STREAM);
        if (stream instanceof Uri) {
            return (Uri) stream;
        }

        return getFirstClipDataUri(intent);
    }

    @Nullable
    private Uri getFirstClipDataUri(Intent intent) {
        ClipData clipData = intent.getClipData();
        if (clipData != null && clipData.getItemCount() > 0) {
            return clipData.getItemAt(0).getUri();
        }

        return null;
    }

    private boolean isLocalUri(Uri uri) {
        String scheme = uri.getScheme();
        return ContentResolver.SCHEME_CONTENT.equals(scheme) ||
        ContentResolver.SCHEME_FILE.equals(scheme);
    }

    private DrawingMetadata readMetadata(ContentResolver resolver, Uri uri) {
        String name = null;
        long size = -1;

        try (
            Cursor cursor = resolver.query(
                uri,
                new String[] {
                    OpenableColumns.DISPLAY_NAME,
                    OpenableColumns.SIZE,
                },
                null,
                null,
                null
            )
        ) {
            if (cursor != null && cursor.moveToFirst()) {
                int nameColumn = cursor.getColumnIndex(
                    OpenableColumns.DISPLAY_NAME
                );
                int sizeColumn = cursor.getColumnIndex(OpenableColumns.SIZE);

                if (nameColumn >= 0 && !cursor.isNull(nameColumn)) {
                    name = cursor.getString(nameColumn);
                }
                if (sizeColumn >= 0 && !cursor.isNull(sizeColumn)) {
                    size = cursor.getLong(sizeColumn);
                }
            }
        } catch (RuntimeException ignored) {
            // Metadata is optional; the granted URI can still be opened.
        }

        return new DrawingMetadata(name, size);
    }

    private String normalizeName(
        @Nullable String displayName,
        Uri uri,
        @Nullable String mimeType
    ) {
        String name = displayName;
        if (name == null || name.trim().isEmpty()) {
            name = uri.getLastPathSegment();
        }
        if (name == null || name.trim().isEmpty()) {
            name = "drawing";
        }

        name = name.replaceAll("[\\\\/\\p{Cntrl}]", "_").trim();
        if (name.isEmpty()) {
            name = "drawing";
        }

        if (!hasDrawingExtension(name)) {
            String inferredExtension = extensionForMimeType(mimeType);
            if (inferredExtension != null) {
                name += inferredExtension;
            }
        }

        return name;
    }

    private boolean hasDrawingExtension(String name) {
        String lowerName = name.toLowerCase(Locale.ROOT);
        return lowerName.endsWith(".dxf") || lowerName.endsWith(".dwg");
    }

    @Nullable
    private String extensionForMimeType(@Nullable String mimeType) {
        if (mimeType == null) {
            return null;
        }

        String normalized = mimeType.toLowerCase(Locale.ROOT);
        if (normalized.contains("dxf")) {
            return ".dxf";
        }
        if (
            normalized.contains("dwg") ||
            normalized.contains("acad") ||
            normalized.contains("autocad")
        ) {
            return ".dwg";
        }
        return null;
    }

    private static final class DrawingMetadata {

        @Nullable
        private final String name;
        private final long size;

        private DrawingMetadata(@Nullable String name, long size) {
            this.name = name;
            this.size = size;
        }
    }
}
