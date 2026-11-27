use std::path::{Component, Path};

/// True when `path` is under Program Files or Program Files (x86) (case-insensitive).
pub fn is_under_program_files(path: &Path) -> bool {
    let normalized = path_to_stem_string(path);
    let pf = std::env::var("ProgramFiles").unwrap_or_else(|_| r"C:\Program Files".into());
    let pf86 =
        std::env::var("ProgramFiles(x86)").unwrap_or_else(|_| r"C:\Program Files (x86)".into());
    is_under_prefix(&normalized, &path_to_stem_string(Path::new(&pf)))
        || is_under_prefix(&normalized, &path_to_stem_string(Path::new(&pf86)))
}

fn is_under_prefix(path: &str, prefix: &str) -> bool {
    if path == prefix {
        return true;
    }
    let with_sep = if prefix.ends_with('\\') {
        prefix.to_string()
    } else {
        format!("{prefix}\\")
    };
    path.starts_with(&with_sep)
}

fn path_to_stem_string(path: &Path) -> String {
    path.components()
        .fold(String::new(), |mut acc, comp| {
            match comp {
                Component::Prefix(p) => acc.push_str(&p.as_os_str().to_string_lossy()),
                Component::RootDir => acc.push('\\'),
                Component::CurDir | Component::ParentDir => {}
                Component::Normal(segment) => {
                    if !acc.is_empty() && !acc.ends_with('\\') {
                        acc.push('\\');
                    }
                    acc.push_str(&segment.to_string_lossy());
                }
            }
            acc
        })
        .to_ascii_lowercase()
}

/// Well-known locations where non-admins can modify files (dev copies, portable installs).
pub fn is_well_known_user_writable_path(path: &Path) -> bool {
    let normalized = path_to_stem_string(path);
    let markers = [
        "\\users\\",
        "\\appdata\\",
        "\\temp\\",
        "\\tmp\\",
        "\\downloads\\",
        "\\desktop\\",
    ];
    markers.iter().any(|m| normalized.contains(m))
}

pub fn ensure_autostart_install_dir(exe: &Path) -> Result<(), String> {
    let dir = exe
        .parent()
        .filter(|p| !p.as_os_str().is_empty())
        .ok_or_else(|| "current_exe has no parent directory".to_string())?;

    if is_under_program_files(dir) {
        return Ok(());
    }

    if is_well_known_user_writable_path(dir) {
        return Err(
            "refusing autostart: install folder is in a user-writable location; install under Program Files"
                .to_string(),
        );
    }

    #[cfg(windows)]
    {
        if dir_writable_by_current_user(dir)? {
            return Err(
                "refusing autostart: install folder is writable by the current user".to_string(),
            );
        }
    }

    Ok(())
}

#[cfg(windows)]
fn dir_writable_by_current_user(dir: &Path) -> Result<bool, String> {
    let probe = dir.join(format!(".pc-temp-write-probe-{}", std::process::id()));
    match std::fs::OpenOptions::new()
        .write(true)
        .create(true)
        .truncate(true)
        .open(&probe)
    {
        Ok(file) => {
            drop(file);
            let _ = std::fs::remove_file(&probe);
            Ok(true)
        }
        Err(e) if e.kind() == std::io::ErrorKind::PermissionDenied => Ok(false),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(false),
        Err(e) => Err(format!("checking write access on {}: {e}", dir.display())),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;

    #[test]
    fn program_files_path_is_trusted() {
        let exe = Path::new(r"C:\Program Files\PC-Temp\pc-temp.exe");
        assert!(ensure_autostart_install_dir(exe).is_ok());
    }

    #[test]
    fn program_files_x86_path_is_trusted() {
        let exe = Path::new(r"C:\Program Files (x86)\PC-Temp\pc-temp.exe");
        assert!(ensure_autostart_install_dir(exe).is_ok());
    }

    #[test]
    fn refuses_well_known_user_writable_install_path() {
        let exe = Path::new(r"C:\Users\nik\Downloads\pc-temp\pc-temp.exe");
        let err = ensure_autostart_install_dir(exe).unwrap_err();
        assert!(err.contains("user-writable"));
    }

    #[test]
    fn refuses_appdata_install_path() {
        let exe = Path::new(r"C:\Users\nik\AppData\Local\pc-temp\pc-temp.exe");
        assert!(ensure_autostart_install_dir(exe).is_err());
    }

    #[test]
    fn does_not_treat_program_files_prefix_lookalike_as_trusted() {
        let exe = Path::new(r"C:\Program FilesEvil\pc-temp.exe");
        assert!(!is_under_program_files(exe.parent().unwrap()));
    }
}
