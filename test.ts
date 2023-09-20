const methodMappingAuthsKey = Symbol('methodMappingAuths');

interface AuthObject {
  advices?: PermissionCode[];
  methods?: {
    [method: string]: PermissionCode[];
  };
  hasRewriteConstructor?: boolean;
}
type ValueOf<T> = {
  [k in keyof T]: T[k];
}[keyof T];

type PermissionCode = any;

const overrideConstructor = (ctr: any) => {
  ctr.prototype.constructor = function permisionConstructor() {
    const methodMappingHandler = getClassMethods(
      ctr
    ).reduce<MethodMappingHandler>((plainObj, method) => {
      plainObj[method] = ctr.prototype[method];
      return plainObj;
    }, {});

    Object.entries(methodMappingHandler).forEach(([method, handler]) => {
      methodMappingHandler[method] = (root: any, variables: any, ctx: any) => {
        const authObject: AuthObject = ctr[methodMappingAuthsKey];
        const requiredPermissions = [
          ...(authObject?.advices ?? []),
          ...(authObject?.methods?.[method] ?? []),
        ];
        const message = `method(url): ${method} requiredPermissions: [${requiredPermissions.join(
          ','
        )}] all permission codes from session: "${ctx?.session?.get(
          'privileges'
        )}`;
        ctx.logger.info('permission', message);

        if (
          requiredPermissions.length > 0 &&
          !ctx?.session
            ?.get('privileges')
            ?.some((p: any) => requiredPermissions.includes(Number(p)))
        ) {
          console.log('ffff');
        }
        return handler(root, variables, ctx);
      };
    });

    return methodMappingHandler;
  };
  return ctr;
};
const injectAuthorizionsThenRewriteConstructorOnce = (
  ctr: any,
  permissionCodes: PermissionCode[],
  method?: any
) => {
  ctr[methodMappingAuthsKey] = ctr[methodMappingAuthsKey] || {};
  const authObject: AuthObject = ctr[methodMappingAuthsKey];
  if (method) {
    authObject.methods ??= {};
    authObject.methods[method] ??= [];
    authObject.methods[method].push(...permissionCodes);
  } else {
    authObject.advices ??= [];
    authObject.advices.push(...permissionCodes);
  }

  if (!authObject.hasRewriteConstructor) {
    authObject.hasRewriteConstructor = true;
    overrideConstructor(ctr);
  }
};

const getClassMethods = (ctr: any) => {
  return Object.getOwnPropertyNames(ctr.prototype).filter(
    (prop) => typeof (ctr[prop] as any) !== 'function' && prop !== 'constructor'
  );
};

const AuthAdvice =
  (...commonPermisionCodes: PermissionCode[]): any =>
  (ctr: any, ...rest: any[]): void => {
    if (rest.length > 0) {
      throw new Error('@AuthAdvice can only apply on class');
    }
    injectAuthorizionsThenRewriteConstructorOnce(ctr, commonPermisionCodes);
    return ctr as any;
  };

const Auth =
  (...permisionCodes: PermissionCode[]): MethodDecorator =>
  (ctr: any, method: string | symbol) => {
    injectAuthorizionsThenRewriteConstructorOnce(
      ctr.constructor,
      permisionCodes,
      method
    );
    return ctr;
  };

interface MethodMappingHandler {
  [method: string]: (root: any, variables: any, ctx: any) => any;
}

@AuthAdvice('sfdfsdf')
class A {
  method1() {
    console.log('method1');
  }
}

const b = new A();
console.log(b);
