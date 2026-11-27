use std::path::{Component, Path};

/// True when `path` is under Program Files or Program Files (x86) (case-insensitive).
#[allow(dead_code)]
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

    if is_well_known_user_writable_path(dir) {
        return Err(
            "refusing autostart: install folder is in a user-writable location; install under Program Files"
                .to_string(),
        );
    }

    #[cfg(windows)]
    {
        for p in [dir, exe.as_ref()] {
            if untrusted_principal_can_write(p)? {
                return Err(format!(
                    "refusing autostart: {} is writable by non-admin users; reinstall PC-Temp under Program Files",
                    p.display()
                ));
            }
        }
    }

    #[cfg(not(windows))]
    {
        let _ = is_under_program_files(dir);
    }

    Ok(())
}

#[cfg(windows)]
const TRUSTED_SID_STRINGS: [&str; 3] = [
    "S-1-5-32-544",
    "S-1-5-18",
    "S-1-5-80-956008885-3418522649-1831038044-1853292631-2271478464",
];

#[cfg(windows)]
const UNTRUSTED_WRITE_MASK: u32 = windows_sys::Win32::Storage::FileSystem::FILE_WRITE_DATA
    | windows_sys::Win32::Storage::FileSystem::FILE_APPEND_DATA
    | windows_sys::Win32::Storage::FileSystem::FILE_WRITE_EA
    | windows_sys::Win32::Storage::FileSystem::FILE_WRITE_ATTRIBUTES
    | windows_sys::Win32::Storage::FileSystem::DELETE
    | windows_sys::Win32::Storage::FileSystem::WRITE_DAC
    | windows_sys::Win32::Storage::FileSystem::WRITE_OWNER
    | windows_sys::Win32::Foundation::GENERIC_WRITE
    | windows_sys::Win32::Foundation::GENERIC_ALL;

#[cfg(windows)]
fn untrusted_principal_can_write(path: &Path) -> Result<bool, String> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Foundation::LocalFree;
    use windows_sys::Win32::Security::Authorization::{GetNamedSecurityInfoW, SE_FILE_OBJECT};
    use windows_sys::Win32::Security::{
        ACL, DACL_SECURITY_INFORMATION, PSECURITY_DESCRIPTOR,
    };

    let wide: Vec<u16> = path
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();

    let mut sd: PSECURITY_DESCRIPTOR = std::ptr::null_mut();
    let mut dacl: *mut ACL = std::ptr::null_mut();

    // SAFETY: `wide` is null-terminated; out pointers are valid for the call.
    let status = unsafe {
        GetNamedSecurityInfoW(
            wide.as_ptr(),
            SE_FILE_OBJECT,
            DACL_SECURITY_INFORMATION,
            std::ptr::null_mut(),
            std::ptr::null_mut(),
            &mut dacl,
            std::ptr::null_mut(),
            &mut sd,
        )
    };
    if status != 0 {
        return Err(format!(
            "reading ACL on {} failed (GetNamedSecurityInfoW {status})",
            path.display()
        ));
    }

    let result = if dacl.is_null() {
        Ok(true)
    } else {
        unsafe { dacl_grants_untrusted_write(dacl) }
    };

    if !sd.is_null() {
        // SAFETY: `sd` was allocated by GetNamedSecurityInfoW and freed with LocalFree.
        unsafe {
            LocalFree(sd as _);
        }
    }

    result
}

#[cfg(windows)]
unsafe fn dacl_grants_untrusted_write(
    dacl: *mut windows_sys::Win32::Security::ACL,
) -> Result<bool, String> {
    use std::ffi::c_void;
    use windows_sys::Win32::Security::{
        GetAce, ACCESS_ALLOWED_ACE, ACE_HEADER,
    };
    use windows_sys::Win32::System::SystemServices::ACCESS_ALLOWED_ACE_TYPE;

    let dacl_ref = dacl.as_ref().ok_or_else(|| "null DACL pointer".to_string())?;
    if dacl_ref.AceCount == 0 {
        return Ok(false);
    }

    for i in 0..dacl_ref.AceCount {
        let mut ace: *mut c_void = std::ptr::null_mut();
        if GetAce(dacl, i as u32, &mut ace) == 0 {
            continue;
        }
        let header = &*(ace as *const ACE_HEADER);
        if header.AceType != ACCESS_ALLOWED_ACE_TYPE as u8 {
            continue;
        }
        if header.AceFlags & (windows_sys::Win32::Security::INHERIT_ONLY_ACE as u8) != 0 {
            continue;
        }
        let allowed = &*(ace as *const ACCESS_ALLOWED_ACE);
        let sid_ptr = std::ptr::addr_of!(allowed.SidStart) as *mut c_void;
        if access_allowed_ace_grants_untrusted_write(allowed.Mask, sid_ptr)? {
            return Ok(true);
        }
    }

    Ok(false)
}

#[cfg(windows)]
fn access_allowed_ace_grants_untrusted_write(
    mask: u32,
    sid: *mut std::ffi::c_void,
) -> Result<bool, String> {
    if mask & UNTRUSTED_WRITE_MASK == 0 {
        return Ok(false);
    }
    if is_trusted_sid(sid)? {
        return Ok(false);
    }
    Ok(true)
}

#[cfg(windows)]
fn is_trusted_sid(sid: *mut std::ffi::c_void) -> Result<bool, String> {
    use windows_sys::Win32::Foundation::LocalFree;
    use windows_sys::Win32::Security::Authorization::ConvertStringSidToSidW;
    use windows_sys::Win32::Security::EqualSid;

    for trusted in TRUSTED_SID_STRINGS {
        let wide: Vec<u16> = trusted.encode_utf16().chain(std::iter::once(0)).collect();
        let mut trusted_sid: *mut std::ffi::c_void = std::ptr::null_mut();
        // SAFETY: UTF-16 SID string with null terminator.
        let ok = unsafe { ConvertStringSidToSidW(wide.as_ptr(), &mut trusted_sid) };
        if ok == 0 {
            continue;
        }
        // SAFETY: Both pointers are valid SIDs from the API.
        let matches = unsafe { EqualSid(sid, trusted_sid) != 0 };
        // SAFETY: ConvertStringSidToSidW uses LocalAlloc.
        unsafe {
            LocalFree(trusted_sid as _);
        }
        if matches {
            return Ok(true);
        }
    }
    Ok(false)
}

#[cfg(all(test, windows))]
mod tests {
    use super::*;
    use std::ffi::c_void;
    use std::path::Path;
    use windows_sys::Win32::Foundation::LocalFree;
    use windows_sys::Win32::Security::Authorization::ConvertStringSidToSidW;
    use windows_sys::Win32::Storage::FileSystem::FILE_WRITE_DATA;

    fn acl_test_dir(name: &str) -> std::path::PathBuf {
        std::path::PathBuf::from(format!(
            r"C:\pctemp-acl-{}-{}",
            std::process::id(),
            name
        ))
    }

    fn sid_from_string(s: &str) -> *mut c_void {
        let wide: Vec<u16> = s.encode_utf16().chain(std::iter::once(0)).collect();
        let mut sid: *mut c_void = std::ptr::null_mut();
        // SAFETY: valid SID string.
        let ok = unsafe { ConvertStringSidToSidW(wide.as_ptr(), &mut sid) };
        assert_ne!(ok, 0);
        sid
    }

    fn free_sid(sid: *mut c_void) {
        // SAFETY: sid from ConvertStringSidToSidW.
        unsafe {
            LocalFree(sid as _);
        }
    }

    #[test]
    fn ace_classifier_trusted_sid_with_write_is_ok() {
        let sid = sid_from_string("S-1-5-32-544");
        let grants = access_allowed_ace_grants_untrusted_write(FILE_WRITE_DATA, sid).unwrap();
        free_sid(sid);
        assert!(!grants);
    }

    #[test]
    fn ace_classifier_users_read_only_is_ok() {
        let sid = sid_from_string("S-1-5-32-545");
        let grants = access_allowed_ace_grants_untrusted_write(
            windows_sys::Win32::Storage::FileSystem::FILE_GENERIC_READ,
            sid,
        )
        .unwrap();
        free_sid(sid);
        assert!(!grants);
    }

    #[test]
    fn ace_classifier_users_write_is_refused() {
        let sid = sid_from_string("S-1-5-32-545");
        let grants = access_allowed_ace_grants_untrusted_write(FILE_WRITE_DATA, sid).unwrap();
        free_sid(sid);
        assert!(grants);
    }

    #[test]
    fn refuses_dir_writable_by_users() {
        let dir = acl_test_dir("refuse");
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        let exe = dir.join("pc-temp.exe");
        std::fs::write(&exe, b"").unwrap();
        let st = std::process::Command::new("icacls")
            .arg(&dir)
            .args(["/grant", "*S-1-5-32-545:(OI)(CI)M"])
            .status()
            .unwrap();
        assert!(st.success());
        let err = ensure_autostart_install_dir(&exe).unwrap_err();
        assert!(err.contains("non-admin users"), "{err}");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn accepts_dir_hardened_like_installer() {
        let dir = acl_test_dir("accept");
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        let exe = dir.join("pc-temp.exe");
        std::fs::write(&exe, b"").unwrap();
        let grant = std::process::Command::new("icacls")
            .arg(&dir)
            .args([
                "/inheritance:r",
                "/grant:r",
                "*S-1-5-32-544:(OI)(CI)F",
                "*S-1-5-18:(OI)(CI)F",
                "*S-1-5-80-956008885-3418522649-1831038044-1853292631-2271478464:(OI)(CI)F",
                "*S-1-5-32-545:(OI)(CI)RX",
            ])
            .status()
            .unwrap();
        assert!(grant.success());
        let reset = std::process::Command::new("icacls")
            .arg(format!("{}\\*", dir.display()))
            .args(["/reset", "/T", "/C", "/Q"])
            .status()
            .unwrap();
        assert!(reset.success());
        ensure_autostart_install_dir(&exe).expect("installer-style ACL should be accepted");
        let _ = std::fs::remove_dir_all(&dir);
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