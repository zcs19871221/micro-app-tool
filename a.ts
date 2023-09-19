const methodMappingAuthsKey = Symbol("methodMappingAuths");

const injectAuthorizions = (ctr: any, method: string, auths: string[]) => {
  ctr[methodMappingAuthsKey] = ctr[methodMappingAuthsKey] || {};
  ctr[methodMappingAuthsKey][method] = ctr[methodMappingAuthsKey][method] || [];
  ctr[methodMappingAuthsKey][method].push(...auths);
};

const getClassMethods = (ctr: any) => {
  return Object.getOwnPropertyNames(ctr.prototype).filter(
    (prop) => typeof (ctr[prop] as any) !== "function"
  );
};
const AuthAdvice =
  (...commonAuths: string[]): any =>
  (ctr: any): void => {
    getClassMethods(ctr).forEach((method) => {
      injectAuthorizions(ctr, method, commonAuths);
    });
    return ctr as any;
  };

const Auth =
  (...auths: string[]): MethodDecorator =>
  (ctr: any, method: string) => {
    injectAuthorizions(ctr.constructor, method, auths);
  };

class BaseAuthClass {
  static init(
    urlMappingHandler: {
      [key: string]: (root: any, variables: any, ctx: any) => any;
    } = {}
  ): any {
    const ctr: any = this;
    const methodMappingHandler = getClassMethods(ctr).reduce<{
      [key: string]: Function;
    }>((plainObj, method) => {
      if (method === "constructor") {
        return plainObj;
      }
      plainObj[method] = ctr.prototype[method];
      return plainObj;
    }, {});
    const keys = Object.keys(urlMappingHandler).concat(
      Object.keys(methodMappingHandler)
    );
    if (keys.length !== new Set(keys).size) {
      throw new Error("通过of初始化的键和在类中定义的method重复，请定义一个");
    }

    const finalMethodMappingHandler = {
      ...urlMappingHandler,
      ...methodMappingHandler,
    };

    Object.entries(finalMethodMappingHandler).forEach(([url, handler]) => {
      finalMethodMappingHandler[url] = (
        root: any,
        variables: any,
        ctx: any
      ) => {
        const requiredPermissions = ctr[methodMappingAuthsKey]?.[url];
        console.log(requiredPermissions);
        if (
          requiredPermissions &&
          !ctx?.session
            ?.get("privileges")
            ?.some((p: any) => requiredPermissions.includes(p))
        ) {
          console.log("no permissions");
        }
        return handler(root, variables, ctx);
      };
    });

    return finalMethodMappingHandler;
  }
}

@AuthAdvice("hello")
class Test extends BaseAuthClass {
  // @AuthMethod("a")
  bbb(input: string) {
    console.log(input);
  }

  ccc(input: string) {
    console.log(input);
  }
}

const x = Test.init();
x.bbb("ffff");
