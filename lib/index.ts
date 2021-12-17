import type { CachedKnowledge, Descriptor, Handler } from "./types";

export default function <T extends Object>(
  target: T,
  handler: Readonly<Handler<T>>,
) {
  if (typeof target !== "function") {
    const cachedKnowledge: CachedKnowledge = {};
    Object.entries(target).forEach(([prop, value]) => {
      cachedKnowledge[prop] = { name: prop, calls: 0, results: [] };
      if (typeof value === "function") {
        target[prop] = function (...args: any[]) {
          if (handler.methodArguments) {
            handler.methodArguments(cachedKnowledge[prop], args);
          }
          let returnValue = value.apply(target, args);
          if (handler.methodReturn) {
            const changed = handler.methodReturn(
              cachedKnowledge[prop],
              returnValue,
            );
            if (typeof changed !== "undefined") {
              returnValue = changed;
            }
          }
          cachedKnowledge[prop].calls += 1;
          cachedKnowledge[prop].results.push(returnValue);
          return returnValue;
        };
      }
    });
  }
  let knowledge: { name: ""; calls: number; results: any[] } = {
    //@ts-ignore
    name: target.name,
    calls: 0,
    results: [],
  };
  return new Proxy(target, {
    get(target: T, prop: string | symbol, receiver) {
      const descriptor: Descriptor = {
        name: prop,
        type: "",
      };
      if (typeof target[prop] === "function") {
        descriptor.type = "method";
      } else {
        descriptor.type = "property";
      }
      if (handler.canGet) {
        const shouldAccess = handler.canGet(descriptor);
        if (!shouldAccess) {
          throw new Error(
            "AccessError: The property " +
              prop.toString() +
              " cannot be accessed",
          );
        }
      }
      if (handler.tapGet) {
        return handler.tapGet(target, prop, receiver);
      }
      return Reflect.get(target, prop, receiver);
    },
    set(target: T, prop: string | symbol, value) {
      const descriptor: Descriptor = {
        name: prop,
        type: "",
      };
      if (typeof target[prop] === "function") {
        descriptor.type = "method";
      } else {
        descriptor.type = "property";
      }
      if (handler.canSet) {
        const result = handler.canSet(descriptor, target[prop], value);
        if (!result) {
          return false;
        }
        if (handler.tapSet) {
          handler.tapSet(target, prop, value);
          return true;
        }
      }
      target[prop] = value;
      return true;
    },
    apply(target, thisArg, args) {
      if (handler.methodArguments) {
        handler.methodArguments(knowledge, args);
      }
      //@ts-ignore
      let returnValue = target.apply(thisArg, args);
      const changed = handler.methodReturn(knowledge, returnValue);
      if (typeof changed !== "undefined") {
        returnValue = changed;
      }
      knowledge.calls += 1;
      knowledge.results.push(returnValue);
      return returnValue;
    },
    ...handler,
  });
}
