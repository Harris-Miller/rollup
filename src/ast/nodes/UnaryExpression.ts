import type { DeoptimizableEntity } from '../DeoptimizableEntity';
import type { HasEffectsContext } from '../ExecutionContext';
import { EMPTY_PATH, type ObjectPath, type PathTracker } from '../utils/PathTracker';
import Identifier from './Identifier';
import type { LiteralValue } from './Literal';
import type * as NodeType from './NodeType';
import { type LiteralValueOrUnknown, UnknownValue } from './shared/Expression';
import { type ExpressionNode, NodeBase } from './shared/Node';

const unaryOperators: {
	[operator: string]: (value: LiteralValue) => LiteralValueOrUnknown;
} = {
	'!': value => !value,
	'+': value => +(value as NonNullable<LiteralValue>),
	'-': value => -(value as NonNullable<LiteralValue>),
	delete: () => UnknownValue,
	typeof: value => typeof value,
	void: () => undefined,
	'~': value => ~(value as NonNullable<LiteralValue>)
};

export default class UnaryExpression extends NodeBase {
	declare argument: ExpressionNode;
	declare operator: '!' | '+' | '-' | 'delete' | 'typeof' | 'void' | '~';
	declare prefix: boolean;
	declare type: NodeType.tUnaryExpression;
	protected deoptimized = false;

	getLiteralValueAtPath(
		path: ObjectPath,
		recursionTracker: PathTracker,
		origin: DeoptimizableEntity
	): LiteralValueOrUnknown {
		if (path.length > 0) return UnknownValue;
		const argumentValue = this.argument.getLiteralValueAtPath(EMPTY_PATH, recursionTracker, origin);
		if (argumentValue === UnknownValue) return UnknownValue;

		return unaryOperators[this.operator](argumentValue);
	}

	hasEffects(context: HasEffectsContext): boolean {
		if (!this.deoptimized) this.applyDeoptimizations();
		if (this.operator === 'typeof' && this.argument instanceof Identifier) return false;
		return (
			this.argument.hasEffects(context) ||
			(this.operator === 'delete' &&
				this.argument.hasEffectsWhenAssignedAtPath(EMPTY_PATH, context))
		);
	}

	hasEffectsWhenAccessedAtPath(path: ObjectPath): boolean {
		if (this.operator === 'void') {
			return path.length > 0;
		}
		return path.length > 1;
	}

	protected applyDeoptimizations(): void {
		this.deoptimized = true;
		if (this.operator === 'delete') {
			this.argument.deoptimizePath(EMPTY_PATH);
			this.context.requestTreeshakingPass();
		}
	}
}
