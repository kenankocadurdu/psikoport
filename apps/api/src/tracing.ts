import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { Resource } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { NestInstrumentation } from '@opentelemetry/instrumentation-nestjs-core';
import { PrismaInstrumentation } from '@prisma/instrumentation';
import { IORedisInstrumentation } from '@opentelemetry/instrumentation-ioredis';

const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318';

const traceExporter = new OTLPTraceExporter({ url: otlpEndpoint });

const metricReader = new PeriodicExportingMetricReader({
  exporter: new OTLPMetricExporter({ url: otlpEndpoint }),
  exportIntervalMillis: 15_000,
});

const sdk = new NodeSDK({
  resource: new Resource({
    [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || 'psikoport-api',
  }),
  traceExporter,
  metricReader,
  instrumentations: [
    new HttpInstrumentation(),
    new NestInstrumentation(),
    new PrismaInstrumentation(),
    new IORedisInstrumentation(),
  ],
});

sdk.start();
