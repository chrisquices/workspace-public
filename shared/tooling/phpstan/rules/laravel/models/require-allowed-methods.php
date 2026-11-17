<?php

namespace Workspace\PHPStan\Models;

use Illuminate\Database\Eloquent\Attributes\Scope as LocalScope;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\Relation;
use PhpParser\Node;
use PHPStan\Analyser\Scope;
use PHPStan\Node\InClassNode;
use PHPStan\Rules\Rule;
use PHPStan\Rules\RuleError;
use PHPStan\Rules\RuleErrorBuilder;
use PHPStan\Type\NeverType;
use PHPStan\Type\ObjectType;

/** @implements Rule<InClassNode> */
class RequireAllowedMethods implements Rule
{
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
        $relationType = new ObjectType(Relation::class);
        $errors = [];

        foreach ($node->getOriginalNode()->getMethods() as $method) {
            $name = $method->name->toString();

            if (preg_match('/^scope[A-Z]/', $name) === 1) {
                continue;
            }

            $reflection = $model->getNativeMethod($name);

            if (! $reflection->isPrivate()) {
                foreach ($reflection->getAttributes() as $attribute) {
                    if ($attribute->getName() === LocalScope::class) {
                        continue 2;
                    }
                }
            }

            $isRelationship = false;

            foreach ($reflection->getVariants() as $variant) {
                foreach ([$variant->getReturnType(), $variant->getNativeReturnType()] as $returnType) {
                    // Never is a subtype of every type, but cannot define a relationship.
                    if (! ($returnType instanceof NeverType) && $relationType->isSuperTypeOf($returnType)->yes()) {
                        $isRelationship = true;

                        break 2;
                    }
                }
            }

            if ($isRelationship) {
                continue;
            }

            $errors[] = RuleErrorBuilder::message('Model method '.$name.'() is not supported by the model rules. Use a Relation return type for relationships or declare a local scope. Add explicit support for other legitimate model behavior in require-allowed-methods.php, or move business logic into a service. Preserve required behavior; do not delete it to silence this violation.')
                ->identifier('workspace.model.requireMethodsToBEAllowed')
                ->line($method->getStartLine())
                ->build();
        }

        return $errors;
    }
}
