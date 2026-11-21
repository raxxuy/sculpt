import { ValidationError } from "../core/errors";
import type {
  InferOutput,
  StandardSchemaIssue,
  StandardSchemaV1,
} from "../core/standard-schema";
import type { Derive } from "../core/types";

const describe = ({ message, path }: StandardSchemaIssue) => {
  const keys = path?.map((segment) =>
    String(typeof segment === "object" ? segment.key : segment),
  );

  return keys?.length ? `${keys.join(".")}: ${message}` : message;
};

export const parse =
  <S extends StandardSchemaV1>(schema: S): Derive<unknown, InferOutput<S>> =>
  (data) => {
    const result = schema["~standard"].validate(data);

    if (result instanceof Promise) {
      throw new Error("Async schemas are not supported");
    }

    if (result.issues) {
      throw new ValidationError(
        result.issues.map(describe).join("; "),
        result.issues,
      );
    }

    return result.value;
  };
