#!/bin/sh
# Publish an over-the-air update to the preview channel (iPhone and Android test builds).
# Usage, from apps/mobile: ./scripts/publish-update.sh "What changed"
#
# Lives outside package.json on purpose: Expo's runtime "fingerprint" includes the
# package.json scripts, so editing them makes installed builds stop taking updates.
set -e
cd "$(dirname "$0")/.."
npx -y eas-cli@latest update --channel preview --environment preview --non-interactive --message "${1:?Say what changed}"
