import {
  Array,
  Chunk,
  Context,
  Effect,
  Either,
  Layer,
  pipe,
  Queue,
  Ref,
  Schedule,
} from "effect";
import {
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
  Worker,
} from "@effect/platform";
import { NodeRuntime, NodeWorker } from "@effect/platform-node";
import * as WT from "node:worker_threads";

function scenarioUrl(port: number, scenario: number): string {
  return `http://localhost:${port}/${scenario}`;
}

function scenario1(port: number) {
  const req = pipe(
    HttpClientRequest.get(scenarioUrl(port, 1)),
    HttpClient.fetchOk,
    HttpClientResponse.text
  );
  return Effect.race(req, req);
}

function scenario2(port: number) {
  const req = pipe(
    HttpClientRequest.get(scenarioUrl(port, 2)),
    HttpClient.fetchOk,
    HttpClientResponse.text
  );
  return Effect.race(req, req);
}

function scenario3(port: number) {
  const req = pipe(
    HttpClientRequest.get(scenarioUrl(port, 3)),
    HttpClient.fetchOk,
    HttpClientResponse.text
  );
  return Effect.raceAll(Array.replicate(req, 10000));
}

function scenario4(port: number) {
  const req = pipe(
    HttpClientRequest.get(scenarioUrl(port, 4)),
    HttpClient.fetchOk,
    HttpClientResponse.text
  );
  return Effect.race(req, req.pipe(Effect.timeout("3 seconds")));
}

function scenario5(port: number) {
  const req = pipe(
    HttpClientRequest.get(scenarioUrl(port, 5)),
    HttpClient.fetchOk,
    HttpClientResponse.text
  );
  return Effect.race(req, req);
}

function scenario6(port: number) {
  const req = pipe(
    HttpClientRequest.get(scenarioUrl(port, 6)),
    HttpClient.fetchOk,
    HttpClientResponse.text
  );
  return Effect.raceAll([req, req, req]);
}

function scenario7(port: number) {
  const req = pipe(
    HttpClientRequest.get(scenarioUrl(port, 7)),
    HttpClient.fetchOk,
    HttpClientResponse.text
  );
  return Effect.race(req, req.pipe(Effect.delay("3 seconds")));
}

function scenario8(port: number) {
  const req = (url: string) =>
    pipe(
      HttpClientRequest.get(url),
      HttpClient.fetchOk,
      HttpClientResponse.text
    );
  const open = req(scenarioUrl(port, 8) + "?open");
  const use = (id: string) => req(scenarioUrl(port, 8) + `?use=${id}`);
  const close = (id: string) =>
    req(scenarioUrl(port, 8) + `?close=${id}`).pipe(Effect.orDie);
  const reqRes = Effect.acquireUseRelease(open, use, close);
  return Effect.race(reqRes, reqRes);
}

function scenario9(port: number) {
  return Effect.gen(function* () {
    const queue = yield* Queue.bounded<string>(5);
    const req = pipe(
      HttpClientRequest.get(scenarioUrl(port, 9)),
      HttpClient.fetchOk,
      HttpClientResponse.text,
      Effect.flatMap((res) => Queue.offer(queue, res))
    );
    yield* Effect.all(Array.replicate(req, 10), {
      concurrency: "unbounded",
      mode: "either",
    });
    const results = yield* Queue.takeAll(queue);
    return Chunk.join(results, "");
  });
}

class Pool extends Context.Tag("@app/Pool")<
  Pool,
  Worker.WorkerPool<void, number>
>() {}
const PoolLive = Worker.makePoolLayer(Pool, { size: 1 }).pipe(
  Layer.provide(NodeWorker.layer(() => new WT.Worker("./worker.ts")))
);

function scenario10(port: number) {
  return Effect.gen(function* () {
    const pool = yield* Pool;
    const id = "id";
    const part1 = Effect.race(
      HttpClientRequest.get(scenarioUrl(port, 10) + "?" + id).pipe(
        HttpClient.fetch
      ),
      pool.executeEffect()
    );

    const load = null;

    const part2 = HttpClientRequest.get(
      scenarioUrl(port, 10) + `?${id}=${load}`
    ).pipe(
      HttpClient.fetch,
      Effect.repeat({
        schedule: Schedule.spaced("1 second"),
        while: (res) => res.status >= 300 && res.status < 400,
      })
    );
    // needs work
    return yield* Effect.zip(part1, part2, { concurrent: true }).pipe(
      Effect.as("right")
    );
  }).pipe(Effect.scoped, Effect.provide(PoolLive));
}

export function program(port: number) {
  return Effect.all([
    scenario1(port),
    scenario2(port),
    scenario3(port),
    scenario4(port),
    scenario5(port),
    scenario6(port),
    scenario7(port),
    scenario8(port),
    scenario9(port),
    scenario10(port),
  ]);
}
