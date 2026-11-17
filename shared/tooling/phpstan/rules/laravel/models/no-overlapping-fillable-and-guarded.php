<?php

namespace Workspace\PHPStan\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Guarded;
use Illuminate\Database\Eloquent\Attributes\Unguarded;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\Pivot;
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
use PHPStan\Type\Type;
use TypeError;

/** @implements Rule<InClassNode> */
class NoOverlappingFillableAndGuarded implements Rule
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

        $model = $node->getClassReflection();
        $fillable = $this->propertyColumns($model, 'fillable');
        $guarded = $this->propertyColumns($model, 'guarded');
        $attributeFillable = $this->attributeColumns($this->classAttribute($model, Fillable::class));

        // Unknown declarations must not be mistaken for empty lists.
        if ($fillable === null || $guarded === null || $attributeFillable === null) {
            return [];
        }

        $fillable = array_unique(array_merge($fillable, $attributeFillable));
        $defaultGuarded = $model->is(Pivot::class) ? [] : ['*'];

        // Laravel consults these attributes only while guarded equals its default.
        if ($guarded === $defaultGuarded) {
            if ($this->classAttribute($model, Unguarded::class) !== null) {
                $guarded = [];
            } elseif (($attribute = $this->classAttribute($model, Guarded::class)) !== null) {
                $guarded = $this->attributeColumns($attribute);
            }
        }

        if ($guarded === null) {
            return [];
        }

        $guarded = array_filter($guarded, static function (string $column): bool {
            return $column !== '*';
        });
        $errors = [];

        foreach ($fillable as $column) {
            // Match Laravel's case-insensitive named guards; never expand '*'.
            if ($column === '*' || empty(preg_grep('/^'.preg_quote($column, '/').'$/i', $guarded))) {
                continue;
            }

            $errors[] = RuleErrorBuilder::message('Attribute "'.$column.'" is both fillable and guarded. Laravel allows it through fillable. Remove it from the list that contradicts your intended behavior.')
                ->identifier('workspace.model.noOverlappingFillableAndGuarded')
                ->line($node->getStartLine())
                ->build();
        }

        return $errors;
    }

    /** @return array<int|string, string>|null */
    private function propertyColumns(ClassReflection $model, string $name): ?array
    {
        $reflection = $model->getNativeReflection();

        if (! $reflection->hasProperty($name)) {
            return null;
        }

        $property = $reflection->getProperty($name);

        try {
            $expression = $property->getDefaultValueExpression();
        } catch (TypeError) {
            // PHPStan's adapter has a non-null return type even for no default.
            return null;
        }

        $declaringClass = $property->getDeclaringClass();
        $context = InitializerExprContext::fromClass($declaringClass->getName(), $declaringClass->getFileName() ?: null);

        return $this->stringArray($this->initializerExprTypeResolver->getType($expression, $context));
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

    /**
     * @param  array{arguments: array<int|string, Expr>, context: InitializerExprContext}|null  $attribute
     * @return array<int|string, string>|null
     */
    private function attributeColumns(?array $attribute): ?array
    {
        if ($attribute === null || $attribute['arguments'] === []) {
            return [];
        }

        $types = [];

        foreach ($attribute['arguments'] as $key => $expression) {
            $types[$key] = $this->initializerExprTypeResolver->getType($expression, $attribute['context']);
        }

        // Both Laravel attributes use the first positional array when present.
        // Otherwise their variadic arguments must all be concrete strings.
        if (isset($types[0]) && $types[0]->isArray()->yes()) {
            return $this->stringArray($types[0]);
        }

        $columns = [];

        foreach ($types as $key => $type) {
            if (! (count($type->getConstantStrings()) === 1 && $type->isConstantScalarValue()->yes())) {
                return null;
            }

            $columns[$key] = $type->getConstantStrings()[0]->getValue();
        }

        return $columns;
    }

    /** @return array<int|string, string>|null */
    private function stringArray(Type $type): ?array
    {
        $arrays = $type->getConstantArrays();

        if (! $type->isConstantArray()->yes() || count($arrays) !== 1 || ! $type->isConstantValue()->yes() || $arrays[0]->getOptionalKeys() !== []) {
            return null;
        }

        $type = $arrays[0];

        $columns = [];
        $keys = $type->getKeyTypes();

        foreach ($type->getValueTypes() as $index => $value) {
            if (! (count($value->getConstantStrings()) === 1 && $value->isConstantScalarValue()->yes())) {
                return null;
            }

            $columns[$keys[$index]->getValue()] = $value->getConstantStrings()[0]->getValue();
        }

        return $columns;
    }
}
