package app.openqomu;

import android.content.Intent;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ApkInstallerPlugin.class);
        clearNotificationHistory(getIntent());
        super.onCreate(savedInstanceState);
    }

    @Override
    public void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        clearNotificationHistory(intent);
    }

    /** Al abrir una notificación, su historial ya no hace falta. */
    private void clearNotificationHistory(Intent intent) {
        if (intent == null) return;
        String group = intent.getStringExtra("openqomu.group");
        if (group != null) {
            openQomuNotificationStore.clear(this, group);
        }
    }
}
