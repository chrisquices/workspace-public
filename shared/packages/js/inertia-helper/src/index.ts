import type {UnwrapNestedRefs} from 'vue';
import {useForm} from '@inertiajs/vue3';
import {onUnmounted, ref} from 'vue';
import {toast} from 'workspace-packages/ui/toast';
import type {InertiaForm} from '@inertiajs/vue3';
import type {ErrorValue, Method, UseFormSubmitOptions} from '@inertiajs/core';

export type InertiaHelperToastResponse = {
  props: {
    flash?: {
      success?: string;
      error?: string;
    };
  };
};

export type InertiaHelperFormConfig = {
  openable?: boolean;
  minimumLoading: boolean;
  minimumLoadingDuration?: number;
};

export type InertiaHelperFormOptions<TConfig extends InertiaHelperFormConfig, TDefinition extends object> = {
  config: TConfig;
  form: TDefinition & ThisType<InertiaHelperForm<TConfig, TDefinition>>;
};

export type OpenableInertiaHelperForm<TData extends object> = {
  isOpen: boolean;
  show(values?: Partial<TData>): void;
  hide(): void;
  setOpen(open: boolean): void;
};

type FormData<T extends object> = {
  [K in keyof T as T[K] extends (...args: never[]) => unknown ? never : K]: T[K];
};

type FormMethods<T extends object> = {
  [K in keyof T as T[K] extends (...args: never[]) => unknown ? K : never]: T[K];
};

type WithOpenable<TConfig extends InertiaHelperFormConfig, TData extends object> = TConfig extends {openable: true}
  ? OpenableInertiaHelperForm<TData>
  : object;

export type InertiaHelperForm<TConfig extends InertiaHelperFormConfig, TDefinition extends object> = UnwrapNestedRefs<
  Omit<InertiaForm<FormData<TDefinition>>, keyof FormMethods<TDefinition>> &
  FormMethods<TDefinition> &
  WithOpenable<TConfig, FormData<TDefinition>>
>;

const defaultMinimumLoadingDuration = 1000;

export function toastFlashMessages(response: InertiaHelperToastResponse): void {
  const success = response.props.flash?.success;
  const error = response.props.flash?.error;

  if (success) toast.success(success);
  if (error) toast.error(error);
}

export function toastFirstValidationError(errors: Record<string, string>): void {
  const message = Object.values(errors)[0];

  if (message) toast.error(String(message));
}

function useSmoothForm(data: object, minimumLoadingDuration: number) {
  const form = useForm(data);
  const processing = ref(false);
  const inertiaMethods = {
    submit: form.submit,
    get: form.get,
    post: form.post,
    put: form.put,
    patch: form.patch,
    delete: form.delete,
  };
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let pending: (() => void) | null = null;

  function flushPending() {
    if (pending !== null) {
      const callback = pending;
      pending = null;
      callback();
    }
  }

  function cancelPending() {
    if (timeout !== null) {
      clearTimeout(timeout);
      timeout = null;
    }

    flushPending();
  }

  function afterMinimumDuration(startedAt: number, callback: () => void) {
    const remaining = Math.max(0, minimumLoadingDuration - (Date.now() - startedAt));
    cancelPending();

    if (remaining === 0) {
      callback();

      return;
    }

    pending = callback;
    timeout = setTimeout(function () {
      timeout = null;
      flushPending();
    }, remaining);
  }

  function waitForMinimumDuration(startedAt: number): Promise<void> {
    return new Promise(function (resolve) {
      return afterMinimumDuration(startedAt, resolve);
    });
  }

  function replaceErrors(errors: Record<string, ErrorValue>) {
    form.clearErrors();

    if (Object.keys(errors).length > 0) {
      form.setError(errors);
    }
  }

  function submit(method: Method, url: string, visitOptions: UseFormSubmitOptions = {}) {
    if (processing.value) {
      return;
    }

    const startedAt = Date.now();
    const previousErrors = {...form.errors};
    const {onSuccess, onError, onFinish} = visitOptions;

    processing.value = true;
    inertiaMethods.submit.call(form, method, url, {
      ...visitOptions,
      async onSuccess(page) {
        replaceErrors(previousErrors);
        await waitForMinimumDuration(startedAt);
        form.clearErrors();

        if (typeof onSuccess === 'function') {
          return onSuccess(page);
        }
      },
      async onError(errors) {
        replaceErrors(previousErrors);
        await waitForMinimumDuration(startedAt);
        replaceErrors(errors);

        if (typeof onError === 'function') {
          return onError(errors);
        }
      },
      onFinish(event) {
        afterMinimumDuration(startedAt, function () {
          processing.value = false;
          onFinish?.(event);
        });
      },
    });
  }

  onUnmounted(cancelPending);

  return new Proxy(form, {
    get(target, property, receiver) {
      if (property === 'processing') return processing.value;

      if (property === 'submit' && Reflect.get(target, property, receiver) === inertiaMethods.submit) {
        return submit;
      }

      if (property === 'get' && Reflect.get(target, property, receiver) === inertiaMethods.get) {
        return ((function (url, options = {}) {
          return submit('get', url, options);
        }) as InertiaForm<object>['get']);
      }

      if (property === 'post' && Reflect.get(target, property, receiver) === inertiaMethods.post) {
        return ((function (url, options = {}) {
          return submit('post', url, options);
        }) as InertiaForm<object>['post']);
      }

      if (property === 'put' && Reflect.get(target, property, receiver) === inertiaMethods.put) {
        return ((function (url, options = {}) {
          return submit('put', url, options);
        }) as InertiaForm<object>['put']);
      }

      if (property === 'patch' && Reflect.get(target, property, receiver) === inertiaMethods.patch) {
        return ((function (url, options = {}) {
          return submit('patch', url, options);
        }) as InertiaForm<object>['patch']);
      }

      if (property === 'delete' && Reflect.get(target, property, receiver) === inertiaMethods.delete) {
        return ((function (url, options = {}) {
          return submit('delete', url, options);
        }) as InertiaForm<object>['delete']);
      }

      return Reflect.get(target, property, receiver);
    },
    set(target, property, value) {
      if (property === 'processing') {
        processing.value = value;

        return true;
      }

      return Reflect.set(target, property, value);
    },
  });
}

export function useInertiaHelperForm<TConfig extends InertiaHelperFormConfig, TDefinition extends object>(options: InertiaHelperFormOptions<TConfig, TDefinition>): InertiaHelperForm<TConfig, TDefinition> {
  const {config, form: definition} = options;

  if (typeof config.minimumLoading !== 'boolean') {
    throw new TypeError('InertiaHelper form option "minimumLoading" must be a boolean.');
  }

  const descriptors: Record<string, PropertyDescriptor> = Object.getOwnPropertyDescriptors(definition);
  const data: Record<string, unknown> = {};

  for (const [member, descriptor] of Object.entries(descriptors)) {
    if (typeof descriptor.value === 'function' || descriptor.get || descriptor.set) {
      continue;
    }

    data[member] = descriptor.value;
    delete descriptors[member];
  }

  if (config.openable) {
    for (const member of ['isOpen', 'show', 'hide', 'setOpen']) {
      if (Object.hasOwn(descriptors, member)) {
        throw new TypeError(`InertiaHelper form member "${member}" is managed when openable.`);
      }
    }
  }

  const form = config.minimumLoading
    ? useSmoothForm(data, config.minimumLoadingDuration ?? defaultMinimumLoadingDuration)
    : useForm((data as object));

  if (!config.minimumLoading && Object.hasOwn(descriptors, 'submit')) {
    const inertiaSubmit = form.submit.bind(form);

    form.get = function (url, requestOptions = {}) {
      return inertiaSubmit('get', url, requestOptions);
    };
    form.post = function (url, requestOptions = {}) {
      return inertiaSubmit('post', url, requestOptions);
    };
    form.put = function (url, requestOptions = {}) {
      return inertiaSubmit('put', url, requestOptions);
    };
    form.patch = function (url, requestOptions = {}) {
      return inertiaSubmit('patch', url, requestOptions);
    };
    form.delete = function (url, requestOptions = {}) {
      return inertiaSubmit('delete', url, requestOptions);
    };
  }

  for (const descriptor of Object.values(descriptors)) {
    if (typeof descriptor.value === 'function') {
      descriptor.value = descriptor.value.bind(form);
    }
  }

  Object.defineProperties(form, descriptors);

  if (config.openable) {

    // These managed members are installed together when openable is enabled.
    const openableForm = (form as InertiaForm<object> & OpenableInertiaHelperForm<object>);
    openableForm.isOpen = false;
    openableForm.show = function (values) {
      if (values !== undefined) {
        Object.assign(form, values);
      }

      openableForm.isOpen = true;
    };
    openableForm.hide = function () {
      openableForm.isOpen = false;
      form.resetAndClearErrors();
    };
    openableForm.setOpen = function (open) {
      open ? openableForm.show() : openableForm.hide();
    };
  }

  // Descriptor installation and conditional members implement the public mapped type.
  return (((form as unknown)) as InertiaHelperForm<TConfig, TDefinition>);
}
