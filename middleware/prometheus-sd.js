const { ServiceBroker } = require("moleculer");
const fs = require("fs").promises;
const pathToFile = "../moleculer-discovery/targets.json";

/**
 * @param {ServiceBroker} broker
 */
async function created(broker) {
  broker.logger.info(
    "Registering Service Discovery Middleware from Prometheus"
  );

  broker.logger.info(`Broker "${broker.nodeID}" will look for target file`);

  try {
    // Only register the targetGenerator if there is a target file
    await fs.access(pathToFile);
    hasTargetsFile = true;
    broker.logger.info(
      `Broker: "${broker.nodeID}" found a Prometheus target file`
    );

    broker.localBus.on("$node.connected", () =>
      targetsHandler(broker, "connected")
    );

    broker.localBus.on("$node.disconnected", () =>
      targetsHandler(broker, "disconnected")
    );
  } catch (error) {
    broker.logger.warn(
      `Broker: "${broker.nodeID}" didn't found a Prometheus target file`
    );
  }
}

/**
 *
 * @param {ServiceBroker} broker
 * @param {string} eventType
 */
async function targetsHandler(broker, eventType) {
  broker.logger.info(
    `Node ${eventType}. Generating new target file for Prometheus`
  );

  // Get new node List
  const nodeList = await broker.call("$node.list", { onlyAvailable: true });

  // Generate new target list
  const targets = targetGenerator(nodeList);

  // Write new targets to targets file
  try {
    fs.writeFile(pathToFile, JSON.stringify(targets, null, 2));
    broker.logger.info("Successfully updated Prometheus target file");
  } catch (error) {
    broker.logger.error(
      `Broker "${broker.nodeID}" couldn't write to Prometheus' target file`
    );
  }
}

/**
 * Generate targets in a Prometheus accepted format
 * More info: https://prometheus.io/docs/prometheus/latest/configuration/configuration/#file_sd_config
 *
 * @param {Array<any>} nodeList Newly available nodes
 * @returns {Array}
 */
function targetGenerator(nodeList) {
  return nodeList.map(node => {
    const t = {};
    t.labels = { job: node.hostname, nodeID: node.id };
    t.targets = [`${node.hostname}:${3030}`];

    return t;
  });
}

module.exports = created;
