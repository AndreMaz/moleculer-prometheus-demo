const { ServiceBroker } = require("moleculer");
const fs = require("fs").promises;
const path = require("path");
const { MoleculerError } = require("moleculer").Errors;
const { BrokerNode } = require("moleculer");
const kleur = require("kleur");

/**
 * Node discovery middleware
 * @param {ServiceBroker} broker
 */
async function created(broker) {
  broker.logger.info(
    "Registering Service Discovery Middleware from Prometheus"
  );

  if (!process.env.TARGETDIR || !process.env.TARGETFILE) {
    broker.logger.error('No Prometheus target file is provided!')
    return
  }

  const pathToTarget = path.join(
    "..",
    process.env.TARGETDIR,
    process.env.TARGETFILE
  );

  broker.logger.info(`Broker@${broker.nodeID} will look for target file`);
  try {
    await createTargetFile(pathToTarget);

    broker.logger.info(
      `Broker@${broker.nodeID} found the Prometheus' target file`
    );

    // Register targetsHandlers
    broker.localBus.on("$node.connected", ({ node }) =>
      regenerateTargets(broker, node, pathToTarget, "connected")
    );

    broker.localBus.on("$node.disconnected", ({ node }) =>
      regenerateTargets(broker, node, pathToTarget, "disconnected")
    );
  } catch (error) {
    // Silent error
    // This middleware will be running at all nodes but only one will have access to the targets file
    broker.logger.warn(
      `Broker@${broker.nodeID} didn't found the Prometheus' target file`
    );
  }
}

/**
 * Generates an updated target list
 * @param {ServiceBroker} broker
 * @param {BrokerNode} node
 * @param {string} pathToTarget
 * @param {string} eventType
 */
async function regenerateTargets(broker, node, pathToTarget, eventType) {
  broker.logger.info(
    `Node "${kleur.green(
      node.id
    )}" ${eventType}. Regenerating target file for Prometheus`
  );

  // Get new node List
  const nodeList = await broker.call("$node.list", { onlyAvailable: true });

  // Generate new target list
  const targets = targetGenerator(nodeList);

  // Write new targets to targets file
  try {
    await fs.writeFile(pathToTarget, JSON.stringify(targets, null, 2));
    broker.logger.info("Successfully updated Prometheus target file");
  } catch (error) {
    broker.logger.warn(
      `Broker@${broker.nodeID} couldn't write to Prometheus' target file`
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

/**
 * Create (if necessary) the target file.
 * @param {string} pathToTarget
 */
async function createTargetFile(pathToTarget) {
  try {
    // Check if file exists
    await fs.access(pathToTarget);
  } catch (error) {
    try {
      // Try to create the targets file
      await fs.writeFile(pathToTarget, JSON.stringify([], null, 2));
    } catch (error) {
      throw new MoleculerError(`Could not create target file`);
    }
  }
}

module.exports = created;
