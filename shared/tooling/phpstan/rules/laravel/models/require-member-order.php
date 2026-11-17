<?php

namespace Workspace\PHPStan\Models;

use Illuminate\Database\Eloquent\Model;
use PhpParser\Node;
use PHPStan\Analyser\Scope;
use PHPStan\Node\InClassNode;
use PHPStan\Rules\Rule;
use PHPStan\Rules\RuleError;
use PHPStan\Rules\RuleErrorBuilder;

/** @implements Rule<InClassNode> */
class RequireMemberOrder implements Rule
{
    public function getNodeType(): string
    {
        return InClassNode::class;
    }

    /**
     * @param  InClassNode  $node
     * @return list<RuleError>
     */
    public function processNode(Node $node, Scope $scope): array
    {
        if (! $node->getClassReflection()->isSubclassOf(Model::class)) {
            return [];
        }

        $propertyRanks = ['table' => 1, 'primaryKey' => 2, 'timestamps' => 3, 'guarded' => 4, 'fillable' => 5, 'hidden' => 6, 'attributes' => 7, 'casts' => 8];
        $declarations = [];

        foreach ($node->getOriginalNode()->stmts as $statement) {
            if ($statement instanceof Node\Stmt\TraitUse) {
                $names = [];

                foreach ($statement->traits as $trait) {
                    $names[] = $trait->toString();
                }

                $declarations[] = ['name' => 'trait use '.implode(', ', $names), 'rank' => 0, 'line' => $statement->getStartLine()];
            } elseif ($statement instanceof Node\Stmt\Property) {
                foreach ($statement->props as $item) {
                    $name = $item->name->toString();

                    if (! isset($propertyRanks[$name])) {
                        continue;
                    }

                    $declarations[] = ['name' => 'property $'.$name, 'rank' => $propertyRanks[$name], 'line' => $item->getStartLine()];
                }
            } elseif ($statement instanceof Node\Stmt\ClassMethod) {
                $declarations[] = ['name' => 'method '.$statement->name->toString().'()', 'rank' => 9, 'line' => $statement->getStartLine()];
            }
        }

        $highestRank = -1;
        $errors = [];

        foreach ($declarations as $declaration) {
            if ($declaration['rank'] < $highestRank) {
                $errors[] = RuleErrorBuilder::message('Model '.$declaration['name'].' is out of order. Arrange declared members in this order: direct trait uses, $table, optional $primaryKey, optional $timestamps, $guarded, $fillable, $hidden, optional $attributes, $casts, then all methods in any order. Constants are ignored. Move declarations without removing behavior.')
                    ->identifier('workspace.model.requireMemberOrder')
                    ->line($declaration['line'])
                    ->build();
            }

            $highestRank = max($highestRank, $declaration['rank']);
        }

        return $errors;
    }
}
