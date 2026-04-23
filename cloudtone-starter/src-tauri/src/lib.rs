// CloudTone - 起步脚手架
// 真正的模块结构请参考《Tauri 开发实战》附录 C（CloudTone 代码索引）
// 以及 Ch 22 的完整 Cargo.toml / lib.rs 模板。

#[tauri::command]
fn greet(name: &str) -> String {
    format!("你好 {}，这是来自 Rust 的问候。", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
