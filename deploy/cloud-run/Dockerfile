# A1 host prototype (private move): the dashboard's static files behind Google sign-in on Cloud Run.
# PROTOTYPE, not live. Nothing builds or deploys this unless the repo variable CLOUD_RUN_DEPLOY is ON
# (see .github/workflows/deploy-cloud-run.yml and docs/priv-move/HOST-A1-CLOUD-RUN.md).
#
# Build context = a folder holding ONLY: this Dockerfile, nginx.conf and _site/ (made by tools/build-site/build.sh).
# So tests, docs, tools and .github can never get into the image: they are not in the context at all.
# The base image runs as a non-root user and listens on 8080, which is Cloud Run's default port.
# Before the first real deploy, pin the base image to a digest (FROM ...@sha256:...).
FROM nginxinc/nginx-unprivileged:stable-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY _site/ /usr/share/nginx/html/
EXPOSE 8080
