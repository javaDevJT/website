#!/bin/sh
set -eu

project_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
app_jar=${1:-"$project_root/target/website-0.0.1-SNAPSHOT.jar"}
helper_package="com/jtdev/website/observability"
helper_pattern="$helper_package/PackagedRuntimeTelemetrySmoke"
smoke_dir=$(mktemp -d "${TMPDIR:-/tmp}/website-telemetry-smoke.XXXXXX")
trap 'rm -rf "$smoke_dir"' EXIT HUP INT TERM
cd "$project_root"

test -f "$app_jar" || { echo "Packaged application JAR not found: $app_jar" >&2; exit 1; }
case "$app_jar" in
    /*) ;;
    *) app_jar="$project_root/$app_jar" ;;
esac
test -f "$project_root/target/test-classes/$helper_pattern.class" || {
    echo "Compile tests before running the packaged telemetry smoke check" >&2
    exit 1
}

jar tf "$app_jar" > "$smoke_dir/app-entries.txt"
if grep -q 'PackagedRuntimeTelemetrySmoke' "$smoke_dir/app-entries.txt"; then
    echo "Smoke helper must not be included in the application JAR" >&2
    exit 1
fi
grep -q 'BOOT-INF/lib/opentelemetry-proto-' "$smoke_dir/app-entries.txt" || {
    echo "Packaged JAR is missing the runtime OTLP protobuf dependency" >&2
    exit 1
}

source_entry='META-INF/website-source-commit'
if grep -Fxq "$source_entry" "$smoke_dir/app-entries.txt"; then
    (cd "$smoke_dir" && jar xf "$app_jar" "$source_entry")
    expected_source_commit=$(cat "$smoke_dir/$source_entry")
    printf '%s' "$expected_source_commit" | grep -Eq '^[0-9a-f]{40}$' || {
        echo "Packaged source identity is malformed" >&2
        exit 1
    }
    packaged_source_present=true
    case "$expected_source_commit" in
        a*) stale_source_commit="b${expected_source_commit#?}" ;;
        *) stale_source_commit="a${expected_source_commit#?}" ;;
    esac
else
    expected_source_commit='aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    stale_source_commit="$expected_source_commit"
    packaged_source_present=false
fi

mkdir -p "$smoke_dir/classes/$helper_package"
cp "$project_root/target/test-classes/$helper_package/PackagedRuntimeTelemetrySmoke"*.class \
    "$smoke_dir/classes/$helper_package/"

export OTEL_RESOURCE_ATTRIBUTES='host.name=website-smoke-host,fixture.safe=packaged-safe-tag,fixture.contact=resource-person@example.net,user.email=filtered-person@example.net'

if ! java \
    -Dloader.path="$smoke_dir/classes" \
    -Dloader.main=com.jtdev.website.observability.PackagedRuntimeTelemetrySmoke \
    -Dwebsite.smoke.expected-source-commit="$expected_source_commit" \
    -Dwebsite.smoke.stale-source-commit="$stale_source_commit" \
    -Dwebsite.smoke.packaged-source-present="$packaged_source_present" \
    -cp "$app_jar" \
    org.springframework.boot.loader.launch.PropertiesLauncher \
    > "$smoke_dir/runtime.log" 2>&1; then
    tail -n 100 "$smoke_dir/runtime.log" >&2
    exit 1
fi

grep '^PACKAGED_TELEMETRY_SMOKE_OK ' "$smoke_dir/runtime.log" || {
    tail -n 100 "$smoke_dir/runtime.log" >&2
    echo "Packaged telemetry smoke check ended without its success marker" >&2
    exit 1
}
