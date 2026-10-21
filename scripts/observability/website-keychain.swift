import AppKit
import Darwin
import Foundation
import Security

/// Website-scoped OpenWoof credential bridge. Secret bytes go only to a private
/// child-process descriptor when the caller explicitly requests a guarded private channel.
enum WebsiteKeychain {
    static let ingestService = "openwoof/openwoof.javadevjt.tech/truenas/website/production"
    static let ingestAccount = "website-backend"
    static let trueNASService = "codex-truenas-mcp"
    static let trueNASAccount = "joshuaterk"
    static let privateSecretFileDescriptor: Int32 = 3

    static func main() -> Never {
        let arguments = Array(CommandLine.arguments.dropFirst())
        switch arguments {
        case ["ensure-ingest-key"]:
            ensureIngestKey()
        case ["read-ingest", "--private-fd", "3"]:
            requirePrivateSecretPipe()
            emit(service: ingestService, account: ingestAccount)
        case ["read-truenas-api", "--private-fd", "3"]:
            requirePrivateSecretPipe()
            emit(service: trueNASService, account: trueNASAccount)
        default:
            fail("usage")
        }
    }

    private static func requirePrivateSecretPipe() {
        var secretPipe = Darwin.stat()
        guard fstat(privateSecretFileDescriptor, &secretPipe) == 0 else {
            fail("private-channel-required")
        }
        let secretPipeType = secretPipe.st_mode & S_IFMT
        guard secretPipeType == S_IFIFO || secretPipeType == S_IFSOCK else {
            fail("private-channel-required")
        }
        for standardDescriptor in [STDOUT_FILENO, STDERR_FILENO] {
            var standardOutput = Darwin.stat()
            if fstat(standardDescriptor, &standardOutput) == 0,
               secretPipe.st_dev == standardOutput.st_dev,
               secretPipe.st_ino == standardOutput.st_ino {
                fail("private-channel-required")
            }
        }
    }

    private static func query(service: String, account: String) -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
    }

    private static func ensureIngestKey() -> Never {
        var attributes: CFTypeRef?
        let base = query(service: ingestService, account: ingestAccount)
        let lookupStatus = SecItemCopyMatching(base.merging([
            kSecReturnAttributes as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]) { _, replacement in replacement } as CFDictionary, &attributes)
        if lookupStatus == errSecSuccess {
            FileHandle.standardOutput.write(Data("already-present\n".utf8))
            exit(EXIT_SUCCESS)
        }
        guard lookupStatus == errSecItemNotFound else { fail("keychain-status") }

        NSApplication.shared.setActivationPolicy(.accessory)
        NSApplication.shared.activate(ignoringOtherApps: true)
        let field = NSSecureTextField(frame: NSRect(x: 0, y: 0, width: 360, height: 24))
        field.placeholderString = "OpenWoof website production ingest key"
        let alert = NSAlert()
        alert.alertStyle = .warning
        alert.messageText = "Create the website OpenWoof Keychain entry?"
        alert.informativeText = "The hidden value will be stored only under \(ingestService) / \(ingestAccount). An existing entry is never replaced."
        alert.accessoryView = field
        alert.addButton(withTitle: "Save Key")
        alert.addButton(withTitle: "Cancel")
        guard alert.runModal() == .alertFirstButtonReturn else {
            field.stringValue = ""
            fail("key-entry-cancelled")
        }

        var key = field.stringValue
        field.stringValue = ""
        guard !key.isEmpty,
              key.utf8.count <= 4096,
              key == key.trimmingCharacters(in: .whitespacesAndNewlines),
              !key.contains(where: \.isWhitespace),
              !key.lowercased().hasPrefix("bearer ") else {
            key.removeAll(keepingCapacity: false)
            fail("invalid-key")
        }

        var bytes = Data(key.utf8)
        key.removeAll(keepingCapacity: false)
        var add = base
        add[kSecValueData as String] = bytes
        add[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlocked
        let status = SecItemAdd(add as CFDictionary, nil)
        bytes.resetBytes(in: 0..<bytes.count)
        guard status == errSecSuccess else {
            // errSecDuplicateItem is deliberately a failure: never update a record
            // that appeared after the read-before-prompt check.
            fail("keychain-write")
        }
        FileHandle.standardOutput.write(Data("created\n".utf8))
        exit(EXIT_SUCCESS)
    }

    private static func emit(service: String, account: String) -> Never {
        var result: CFTypeRef?
        let status = SecItemCopyMatching(query(service: service, account: account).merging([
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]) { _, replacement in replacement } as CFDictionary, &result)
        guard status == errSecSuccess, var bytes = result as? Data, !bytes.isEmpty else {
            fail("keychain-read")
        }
        result = nil
        FileHandle(fileDescriptor: privateSecretFileDescriptor, closeOnDealloc: false).write(bytes)
        bytes.resetBytes(in: 0..<bytes.count)
        exit(EXIT_SUCCESS)
    }

    private static func fail(_ code: String) -> Never {
        FileHandle.standardError.write(Data("website-keychain: \(code)\n".utf8))
        exit(EXIT_FAILURE)
    }
}

WebsiteKeychain.main()
