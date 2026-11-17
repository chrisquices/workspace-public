<?php

namespace Workspace\PHPStan\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Notifications\Notifiable;
use PhpParser\Node;
use PHPStan\Analyser\Scope;
use PHPStan\Node\InClassNode;
use PHPStan\Rules\Rule;
use PHPStan\Rules\RuleError;
use PHPStan\Rules\RuleErrorBuilder;

/** @implements Rule<InClassNode> */
class RequireAllowedTraits implements Rule
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

        $allowed = [
            strtolower(HasFactory::class),
            strtolower(Notifiable::class),
            strtolower(SoftDeletes::class),
        ];
        $errors = [];

        foreach ($node->getOriginalNode()->stmts as $statement) {
            if (! $statement instanceof Node\Stmt\TraitUse) {
                continue;
            }

            foreach ($statement->traits as $trait) {
                $name = $scope->resolveName($trait);

                if (in_array(strtolower($name), $allowed, true)) {
                    continue;
                }

                $errors[] = RuleErrorBuilder::message('Model trait '.$name.' is not supported by the model rules. Keep this trait and add support for it in require-allowed-traits.php, including any required dedicated rules. Do not remove the trait to silence this violation.')
                    ->identifier('workspace.model.requireTraitsToBeAllowed')
                    ->line($trait->getStartLine())
                    ->build();
            }
        }

        return $errors;
    }
}
