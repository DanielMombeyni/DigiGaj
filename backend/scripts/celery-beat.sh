#!/bin/sh
exec celery -A config beat -l info
