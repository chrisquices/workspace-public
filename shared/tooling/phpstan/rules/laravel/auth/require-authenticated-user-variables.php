<?php

namespace Workspace\PHPStan\Auth;

use Illuminate\Contracts\Auth\Factory as AuthFactory;
use Illuminate\Contracts\Auth\Guard;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Request as RequestFacade;
use PhpParser\Node;
use PhpParser\Node\Expr\MethodCall;
use PhpParser\Node\Expr\NullsafeMethodCall;
use PhpParser\Node\Expr\StaticCall;
use PhpParser\Node\Identifier;
use PhpParser\Node\Name;
use PhpParser\NodeFinder;
use PHPStan\Analyser\Scope;
use PHPStan\Parser\Parser;
use PHPStan\Rules\Rule;
use PHPStan\Rules\RuleError;
use PHPStan\Rules\RuleErrorBuilder;
use PHPStan\Type\ObjectType;
use PHPStan\Type\TypeCombinator;

/** @implements Rule<Node> */
class RequireAuthenticatedUserVariables implements Rule
{
    /** @var array<string, array<int, string>> */
    private array $authenticatedUserAssignments = [];

    public function __construct(private readonly Parser $parser) {}

    public function getNodeType(): string
    {
        return Node::class;
    }

    /** @return list<RuleError> */
    public function processNode(Node $node, Scope $scope): array
    {
        if ((! $node instanceof StaticCall && ! $node instanceof MethodCall && ! $node instanceof NullsafeMethodCall)
            || $node->getAttribute('virtualNullsafeMethodCall', false)
            || $node->isFirstClassCallable()) {
            return [];
        }

        if ($node->name instanceof Identifier) {
            $methodName = strtolower($node->name->toString());
        } else {
            $names = $scope->getType($node->name)->getConstantStrings();
            $methodName = count($names) === 1 ? strtolower($names[0]->getValue()) : '';
        }

        if ($methodName !== 'user' && $methodName !== 'id') {
            return [];
        }

        $receiver = $node instanceof StaticCall ? $node->class : $node->var;
        $receiverType = $receiver instanceof Name ? $scope->resolveTypeByName($receiver) : $scope->getType($receiver);

        if ($node instanceof StaticCall) {
            $receiverType = $receiverType->getObjectTypeOrClassStringObjectType();
        }

        $authenticationTypes = [new ObjectType(Auth::class), new ObjectType(AuthFactory::class), new ObjectType(Guard::class)];

        if ($methodName === 'user') {
            $authenticationTypes[] = new ObjectType(Request::class);
            $authenticationTypes[] = new ObjectType(RequestFacade::class);
        }

        if (! TypeCombinator::union(...$authenticationTypes)->isSuperTypeOf(TypeCombinator::removeNull($receiverType))->yes()) {
            return [];
        }

        $variableName = $methodName === 'user' ? 'user' : 'userId';
        // A trait's source positions belong to the trait file, not its consuming class.
        $file = $scope->getTraitReflection()?->getFileName() ?: $scope->getFile();

        if (! isset($this->authenticatedUserAssignments[$file])) {
            $this->authenticatedUserAssignments[$file] = $this->findAuthenticatedUserAssignments($file);
        }

        if (($this->authenticatedUserAssignments[$file][$node->getStartFilePos()] ?? null) === $variableName) {
            return [];
        }

        $value = $methodName === 'user' ? 'authenticated user' : 'authenticated user ID';

        return [
            RuleErrorBuilder::message("Assign the {$value} to \${$variableName} in a separate statement before using it.")
                ->identifier('workspace.general.requireAuthenticatedUserVariables')
                ->line($node->getStartLine())
                ->build(),
        ];
    }

    /** @return array<int, string> */
    private function findAuthenticatedUserAssignments(string $file): array
    {
        $assignments = [];

        // Index source statements once; call-site scopes still determine whether
        // each receiver is Laravel authentication or an unrelated user()/id() method.
        foreach ((new NodeFinder)->findInstanceOf($this->parser->parseFile($file), Node\Stmt\Expression::class) as $statement) {
            $assignment = $statement->expr;

            if ((! $assignment instanceof Node\Expr\Assign && ! $assignment instanceof Node\Expr\AssignRef)
                || ! $assignment->var instanceof Node\Expr\Variable
                || ! is_string($assignment->var->name)) {
                continue;
            }

            $expression = $assignment->expr;

            // ID casts may accompany the assignment without allowing inline retrieval.
            if ($assignment->var->name === 'userId') {
                while ($expression instanceof Node\Expr\Cast\Int_ || $expression instanceof Node\Expr\Cast\String_) {
                    $expression = $expression->expr;
                }
            }

            if (($expression instanceof StaticCall || $expression instanceof MethodCall || $expression instanceof NullsafeMethodCall)
                && $expression->getStartFilePos() >= 0) {
                $assignments[$expression->getStartFilePos()] = $assignment->var->name;
            }
        }

        return $assignments;
    }
}
