Read and follow: ../../AGENTS.md
Read and follow: README.md

## Reinforce existing static-analysis rules

Apply the intent of the linked rules even when a particular implementation passes ESLint or PHPStan. Do not bypass a restriction through callbacks, private methods, aliases, wrappers, or weaker types. Preserve required behavior when moving it to the appropriate layer.

### Controllers

- Delegate iteration, calculations, and model operations to the layers permitted by the existing rules.
- Do not replace forbidden loops with collection callbacks or move business logic into private controller methods merely to pass analysis.
- Existing rules: [no-loops.php](../../shared/tooling/phpstan/rules/laravel/controllers/no-loops.php), [no-arithmetic-operations.php](../../shared/tooling/phpstan/rules/laravel/controllers/no-arithmetic-operations.php), [no-model-usage.php](../../shared/tooling/phpstan/rules/laravel/controllers/no-model-usage.php).

### Requests and validation

- Put request validation in Form Requests and consume validated input in controllers.
- Do not recreate request validation through controller conditionals or mix raw input back into validated data.
- Existing rules: [no-request-validation.php](../../shared/tooling/phpstan/rules/laravel/controllers/no-request-validation.php), [no-unvalidated-form-request-input.php](../../shared/tooling/phpstan/rules/laravel/controllers/no-unvalidated-form-request-input.php).

### Services

- Accept explicit values and identifiers rather than Request objects or Eloquent models.
- Do not disguise requests or models inside generic arrays or objects to bypass parameter checks.
- Leave HTTP, Inertia, and resource response construction to callers.
- Existing rules: [no-request-parameters.php](../../shared/tooling/phpstan/rules/laravel/services/no-request-parameters.php), [no-model-parameters.php](../../shared/tooling/phpstan/rules/laravel/services/no-model-parameters.php), [no-http-responses.php](../../shared/tooling/phpstan/rules/laravel/services/no-http-responses.php), [no-resource-responses.php](../../shared/tooling/phpstan/rules/laravel/services/no-resource-responses.php).

### Models

- Keep declared methods limited to relationships and local scopes supported by the existing rules.
- Relationship and scope definitions may construct queries, but must not retrieve data.
- Do not disguise business workflows as scopes or relationship methods. Preserve legitimate behavior by moving it to a service or obtaining explicit support in the rules, rather than deleting it to silence a violation.
- Existing rules: [require-allowed-methods.php](../../shared/tooling/phpstan/rules/laravel/models/require-allowed-methods.php), [no-queries-outside-services.php](../../shared/tooling/phpstan/rules/laravel/eloquent/no-queries-outside-services.php).

### Policies

- Keep policies focused on authorization decisions. Delegate database operations to services and calculations to a service or helper as permitted by the existing rules.
- Do not hide calculations or database workflows inside callbacks or private policy methods.
- Existing rules: [no-database-operations.php](../../shared/tooling/phpstan/rules/laravel/policies/no-database-operations.php), [no-arithmetic-operations.php](../../shared/tooling/phpstan/rules/laravel/policies/no-arithmetic-operations.php).

### Vue and UI

- Use shared UI primitives. Do not replace a forbidden native button with a clickable div to bypass the rule.
- Keep click handlers to a method reference or one direct call. Do not hide multi-step inline handlers in expressions; put the workflow in an action method.
- Existing rules: [no-native-button.js](../../shared/packages/js/ui/rules/consumer/no-native-button.js), [require-single-call-click-handler.js](../../shared/tooling/eslint/rules/vue/require-single-call-click-handler.js).
