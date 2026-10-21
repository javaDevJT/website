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

mkdir -p "$smoke_dir/classes/$helper_package"
cp "$project_root/target/test-classes/$helper_package/PackagedRuntimeTelemetrySmoke"*.class \
    "$smoke_dir/classes/$helper_package/"

if ! java \
    -Dloader.path="$smoke_dir/classes" \
    -Dloader.main=com.jtdev.website.observability.PackagedRuntimeTelemetrySmoke \
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
