import { WorkerRunner } from "@effect/platform";
import { NodeRuntime, NodeWorkerRunner } from "@effect/platform-node";
import { Layer, pipe, Stream, Option } from "effect";

const WorkerLive = pipe(
  Layer.scopedDiscard(
    WorkerRunner.make(() =>
      Stream.unfold([0, 1], ([a, b]) => Option.some([a, [b, a + b]]))
    )
  ),
  Layer.provide(NodeWorkerRunner.layer)
);

NodeRuntime.runMain(Layer.launch(WorkerLive));
