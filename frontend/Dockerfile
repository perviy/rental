FROM nginx:1.25-alpine

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy our nginx config
COPY nginx.conf /etc/nginx/conf.d/

# Copy static frontend files
COPY client/  /usr/share/nginx/html/client/
COPY admin/   /usr/share/nginx/html/admin/
COPY css/     /usr/share/nginx/html/css/
COPY js/      /usr/share/nginx/html/js/

EXPOSE 80
