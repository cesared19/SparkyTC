#!/usr/bin/env bash
# Frees the disk of what Docker leaves behind: the images and build cache of earlier builds (every
# `docker compose up --build` leaves the previous images without a name) and the stopped containers of a day ago.
# It never removes volumes, and never anything a running container uses. Run it from the server, e.g. after an
# upgrade or every week from cron:
#
#   deploy/maintenance/cleanup.sh              clean up
#   deploy/maintenance/cleanup.sh --dry-run    only show what Docker holds
#   deploy/maintenance/cleanup.sh --all-images also remove every image no container uses and that is over 30 days old
#
# cron, every Sunday at 4:
#   0 4 * * 0  cd /path/to/sparkytc && deploy/maintenance/cleanup.sh >> /var/log/sparkytc-cleanup.log 2>&1

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."

dry_run=no
all_images=no
for argument in "$@"; do
	case "$argument" in
	--dry-run) dry_run=yes ;;
	--all-images) all_images=yes ;;
	*)
		echo "usage: cleanup.sh [--dry-run] [--all-images]" >&2
		exit 1
		;;
	esac
done

echo "$(date '+%Y-%m-%d %H:%M:%S') Docker before:"
docker system df
echo

if [[ "$dry_run" == yes ]]; then
	echo "Images without a name (they would be removed):"
	docker image ls --filter dangling=true --format '  {{.ID}}  {{.Size}}  created {{.CreatedSince}}'
	echo "Nothing was removed (--dry-run)."
	exit 0
fi

docker container prune --force --filter until=24h
docker image prune --force
docker builder prune --force --filter until=168h
if [[ "$all_images" == yes ]]; then
	docker image prune --all --force --filter until=720h
fi

echo
echo "$(date '+%Y-%m-%d %H:%M:%S') Docker after:"
docker system df
