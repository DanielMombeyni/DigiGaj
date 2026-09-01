#!/bin/sh
exec celery -A config worker -l info
