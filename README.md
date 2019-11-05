# moleculer-prometheus-demo [![Moleculer](https://badgen.net/badge/Powered%20by/Moleculer/0e83cd)](https://moleculer.services)

This is a demo repo showing how to use Prometheus [File-based Service Discovery](https://prometheus.io/docs/guides/file-sd/) to dynamically find and scrap metrics from Moleculer services.

> This demo is based on [moleculer-demo](https://moleculer.services/docs/0.13/usage.html#Create-a-Moleculer-project)

## ToDo:

- [ ] Share via Docker's volumes `target.json` with Moleculer services.
- [ ] Create a script that will update `target.json` every time new Moleculer node is connected.
- [ ] **Bonus:** Moleculer v0.14 needs `python` and `gcc` to install [`event-loop-stats`](https://github.com/bripkens/event-loop-stats). Adding `RUN apk add --no-cache python3 make g++` to Dockerfile produces multiple warnings (see an [example](media/warnings.png)). Need to investigate what's happening.

## Example

Run `npm run dc:up` and open [http://localhost:9090/targets](http://localhost:9090/targets). You should get something like:
![image](media/prometheus.png)

### Useful Links

- [http://localhost:3000/](http://localhost:3000/) - Make a call to [API Gateway](https://moleculer.services/docs/0.14/moleculer-web.html)
- [http://localhost:3001/dashboard/](http://localhost:3001/dashboard/) - Call [Traefik](https://traefik.io/)
- [http://localhost:9090/graph](http://localhost:9090/graph) - Call Prometheus server
- [http://localhost:9100/metrics](http://localhost:9100/metrics) - Check `api` service metrics
- [http://localhost:9200/metrics](http://localhost:9100/metrics) - Check `greeter` service metrics

## Guide

1. Open `moleculer.config.js`, enable metrics and set Prometheus as a reporter. [More info](https://moleculer.services/docs/0.14/metrics.html#Prometheus)

   **moleculer.config.js**

   ```js
   {
     // Other configs
     metrics: {
           enabled: true,
           reporter: [
               {
                   type: "Prometheus",
                   options: {
                       // HTTP port
                       port: 3030,
                       // HTTP URL path
                       path: "/metrics",
                       // Default labels which are appended to all metrics labels
                       defaultLabels: registry => ({
                           namespace: registry.broker.namespace,
                           nodeID: registry.broker.nodeID
                       })
                   }
               }
           ]
       }
   }
   ```

2. Create a container for the `greeter` service. Define a `hostname` for it and (optionally) a `port` allowing to read its metrics.

   **docker-compose.yml**

   ```yml
   greeter:
     build:
       context: .
     image: moleculer-prometheus-demo
     hostname: greeter ## Define the hostname. It will be used to inform Prometheus
     container_name: moleculer-prometheus-demo-greeter
     env_file: docker-compose.env
     environment:
       SERVICES: greeter
     labels:
       - "traefik.enable=false"
     depends_on:
       - nats
     ports:
       - 9200:3030 ## Add a port in order to access the metrics
     networks:
       - internal
   ```

3. Create a container for [Prometheus](https://prometheus.io/). Add volumes for `prometheus.yml` and `targets.json`

   **docker-compose.yml**

   ```yaml
   prometheus:
     image: prom/prometheus:latest
     container_name: prometheus
     ports:
       - 9090:9090
     command:
       - --config.file=/etc/prometheus/prometheus.yml
     volumes:
       ## Custom Prometheus configuration file
       - ./prometheus.yml:/etc/prometheus/prometheus.yml:ro
       ## Target file
       - ./targets.json:/etc/prometheus/targets.json:ro
     networks:
       - internal
   ```

4. Create a configuration file `prometheus.yml` for Prometheus

   **prometheus.yml**

   ```yml
   ## General configs
   global:
     scrape_interval: 15s
     scrape_timeout: 10s
     evaluation_interval: 15s
   alerting:
     alertmanagers:
       - static_configs:
           - targets: []
         scheme: http
         timeout: 10s
         api_version: v1
   scrape_configs:
     - job_name: prometheus
       honor_timestamps: true
       scrape_interval: 15s
       scrape_timeout: 10s
       metrics_path: /metrics
       scheme: http
       static_configs:
         - targets:
             - localhost:9090
     ## Add a job for Moleculer services
     - job_name: "moleculer"
       scheme: http
       file_sd_configs:
         - files:
             - "targets.json" ## The actual targets will be specified in target.json file
           refresh_interval: 10s
   ```

5. Create `targets.json` and specify the targets that Prometheus should track and scrap metrics from. [More info](https://prometheus.io/docs/prometheus/latest/configuration/configuration/#file_sd_config). Prometheus watches the `targets.json` file and will track any target that's present in `targets.json`. In this case, Prometheus will try to read from http://api:3030/metrics and http://greeter:3030/metrics

   **targets.json**

   ```js
   [
     {
       labels: {
         job: "api"
       },
       targets: ["api:3030"] // "api" is the hostname that we've defined in docker-compose.yml
     },
     {
       labels: {
         job: "greeter"
       },
       targets: ["greeter:3030"] // "greeter" is the hostname that we've defined in docker-compose.yml
     }
   ];
   ```

6. Run `npm run dc:up`
