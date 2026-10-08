/** `Database: localhost:5432/monti [from env DATABASE_URL]` */
export const formatDecision = (decision) => `${decision.topic}: ${decision.value} [${decision.source}]`;
