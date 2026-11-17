<?php

namespace Workspace\PHPStan\Models;

use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Model;
use PhpParser\Node;
use PhpParser\Node\Expr;
use PHPStan\Analyser\Scope;
use PHPStan\Node\InClassNode;
use PHPStan\Reflection\ClassReflection;
use PHPStan\Reflection\InitializerExprContext;
use PHPStan\Reflection\InitializerExprTypeResolver;
use PHPStan\Rules\Rule;
use PHPStan\Rules\RuleError;
use PHPStan\Rules\RuleErrorBuilder;
use TypeError;

/** @implements Rule<InClassNode> */
class RequirePrimaryKeyInGuardedProperty implements Rule
{
    public function __construct(private readonly InitializerExprTypeResolver $initializerExprTypeResolver) {}

    public function getNodeType(): string
    {
        return InClassNode::class;
    }

    /**
     * @param InClassNode $node
     * @return list<RuleError>
     */
    public function processNode(Node $node, Scope $scope): array
    {
        if (! $node->getClassReflection()->isSubclassOf(Model::class)) {
            return [];
        }

        $class = $node->getOriginalNode();
        $property = $class->getProperty('guarded');
        $declaration = null;

        if ($property !== null) {
            foreach ($property->props as $item) {
                if ($item->name->toString() === 'guarded') {
                    $declaration = $item;

                    break;
                }
            }
        } else {
            foreach ($class->getMethod('__construct')->params ?? [] as $parameter) {
                if ($parameter->isPromoted() && $parameter->var instanceof Expr\Variable && $parameter->var->name === 'guarded') {
                    $declaration = $parameter;

                    break;
                }
            }
        }

        if ($declaration === null) {
            return [];
        }

        $model = $node->getClassReflection();
        $reflection = $model->getNativeReflection();

        if (! $reflection->hasProperty('primaryKey')) {
            return [];
        }

        // Read declarations only; constructor assignments and runtime key changes are not traced.
        $keyProperty = $reflection->getProperty('primaryKey');
        $declaringClass = $keyProperty->getDeclaringClass();
        $keyExpression = null;

        if ($keyProperty->isPromoted()) {
            foreach ($declaringClass->getConstructor()?->getParameters() ?? [] as $parameter) {
                if ($parameter->isPromoted() && $parameter->getName() === 'primaryKey' && $parameter->isDefaultValueAvailable()) {
                    $keyExpression = $parameter->getDefaultValueExpression();

                    break;
                }
            }
        } else {
            try {
                $keyExpression = $keyProperty->getDefaultValueExpression();
            } catch (TypeError) {
                // PHPStan's adapter can throw when a property has no default.
                return [];
            }
        }

        if ($keyExpression === null) {
            return [];
        }

        $context = InitializerExprContext::fromClass($declaringClass->getName(), $declaringClass->getFileName() ?: null);
        $keyType = $this->initializerExprTypeResolver->getType($keyExpression, $context);

        if (! (count($keyType->getConstantStrings()) === 1 && $keyType->isConstantScalarValue()->yes())) {
            return [];
        }

        $primaryKey = $keyType->getConstantStrings()[0]->getValue();

        // Laravel applies Table.key only while primaryKey is exactly its default 'id'.
        if ($primaryKey === 'id' && ($attribute = $this->classAttribute($model, Table::class)) !== null) {
            $keyArgument = $attribute['arguments']['key'] ?? $attribute['arguments'][1] ?? null;

            if ($keyArgument !== null) {
                $attributeKeyType = $this->initializerExprTypeResolver->getType($keyArgument, $attribute['context']);

                if ((count($attributeKeyType->getConstantStrings()) === 1 && $attributeKeyType->isConstantScalarValue()->yes())) {
                    $primaryKey = $attributeKeyType->getConstantStrings()[0]->getValue();
                } elseif (! $attributeKeyType->isNull()->yes()) {
                    return [];
                }
            }
        }

        $default = $declaration->default;

        if ($default !== null) {
            $guardedType = $scope->getType($default);

            $arrays = $guardedType->getConstantArrays();

            if ($guardedType->isConstantArray()->yes() && count($arrays) === 1 && $guardedType->isConstantValue()->yes() && $arrays[0]->getOptionalKeys() === []) {
                foreach ($arrays[0]->getValueTypes() as $column) {
                    // Named guards match case-insensitively; '*' is not an explicit column.
                    if ((count($column->getConstantStrings()) === 1 && $column->isConstantScalarValue()->yes()) && $column->getConstantStrings()[0]->getValue() !== '*' && preg_match('/^'.preg_quote($primaryKey, '/').'$/i', $column->getConstantStrings()[0]->getValue()) === 1) {
                        return [];
                    }
                }
            } elseif (! $guardedType->isArray()->no()) {
                // An unknown list cannot prove that the configured key is absent.
                return [];
            }
        }

        return [
            RuleErrorBuilder::message('$guarded must explicitly include the primary-key column "'.$primaryKey.'".')
                ->identifier('workspace.model.requirePropertyGuardedToContainPrimaryKey')
                ->line(($default ?? $declaration)->getStartLine())
                ->build(),
        ];
    }

    /**
     * @param  class-string  $attributeName
     * @return array{arguments: array<int|string, Expr>, context: InitializerExprContext}|null
     */
    private function classAttribute(ClassReflection $model, string $attributeName): ?array
    {
        do {
            // Laravel checks the class, its direct traits, then its parent.
            foreach ([$model, ...array_values($model->getTraits())] as $source) {
                $attributes = $source->getNativeReflection()->getAttributes($attributeName);

                if ($attributes !== []) {
                    $arguments = $attributes[0]->getArgumentsExpressions();
                    $context = InitializerExprContext::fromClassReflection($source);

                    return ['arguments' => $arguments, 'context' => $context];
                }
            }

            $model = $model->getParentClass();
        } while ($model !== null);

        return null;
    }
}
