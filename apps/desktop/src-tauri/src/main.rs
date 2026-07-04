// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use tauri::Manager;
use tauri_plugin_updater::UpdaterExt;

#[tauri::command]
async fn check_update(app: tauri::AppHandle) -> Result<String, String> {
    match app.updater().check().await {
        Ok(Some(update)) => Ok(format!(
            "Update available: {} → {}",
            update.current_version,
            update.version
        )),
        Ok(None) => Ok("Up to date".to_string()),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
async fn install_update(app: tauri::AppHandle) -> Result<(), String> {
    if let Ok(Some(update)) = app.updater().check().await {
        update.download_and_install(|_, _| {}, || {}).await.map_err(|e| e.to_string())?;
        app.restart();
    }
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![check_update, install_update])
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();
            window.navigate("https://lensly-90c3d.web.app".parse().unwrap())?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Lensly");
}
