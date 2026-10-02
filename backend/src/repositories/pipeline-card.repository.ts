import {
  pipelineCardOutputRelations,
  toPipelineCardOutput,
  type CardClosing,
  type PipelineCardRecord,
  type StageCardsPage,
  type StageCardsQuery,
} from '@/models/pipeline.model';
import type { DatabaseClient, DatabaseTransaction } from '@/repositories/database-client';

export interface NewCard {
  pipelineId: string;
  stageId: string;
  leadId: string;
  addedById: string | null;
}

export interface CardDestination {
  stageId: string;
  previousCardId: string | null;
  closing: CardClosing | undefined;
}

export interface IPipelineCardRepository {
  findStageCardsPage(stageId: string, query: StageCardsQuery): Promise<StageCardsPage>;
  findCard(cardId: string): Promise<PipelineCardRecord | null>;
  addCardOnTop(newCard: NewCard): Promise<void>;
  moveCard(cardId: string, destination: CardDestination): Promise<void>;
  removeCard(cardId: string): Promise<void>;
}

export const CARD_POSITION_GAP = 1024;
const SMALLEST_GAP_BEFORE_RENUMBERING = 1e-6;

const visibleCards = { lead: { deletedAt: null } };

export class PipelineCardRepository implements IPipelineCardRepository {
  constructor(private readonly prisma: DatabaseClient) {}

  async findStageCardsPage(stageId: string, { afterPosition, limit }: StageCardsQuery): Promise<StageCardsPage> {
    const [cards, totalCards] = await Promise.all([
      this.prisma.pipelineCard.findMany({
        where: { stageId, ...visibleCards, ...(afterPosition !== null && { position: { gt: afterPosition } }) },
        include: pipelineCardOutputRelations,
        orderBy: [{ position: 'asc' }, { id: 'asc' }],
        take: limit,
      }),
      this.prisma.pipelineCard.count({ where: { stageId, ...visibleCards } }),
    ]);
    const lastCard = cards.at(-1);
    return {
      stageId,
      cards: cards.map(toPipelineCardOutput),
      totalCards,
      nextAfterPosition: cards.length === limit && lastCard ? lastCard.position : null,
    };
  }

  async findCard(cardId: string): Promise<PipelineCardRecord | null> {
    return await this.prisma.pipelineCard.findUnique({
      where: { id: cardId },
      select: { id: true, pipelineId: true, stageId: true, leadId: true, position: true },
    });
  }

  async addCardOnTop({ pipelineId, stageId, leadId, addedById }: NewCard): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      const position = await this.findPositionOnTop(transaction, stageId, null);
      await transaction.pipelineCard.create({ data: { pipelineId, stageId, leadId, addedById, position } });
    });
  }

  async moveCard(cardId: string, { stageId, previousCardId, closing }: CardDestination): Promise<void> {
    await this.prisma.$transaction(async (transaction) => {
      const position =
        previousCardId === null
          ? await this.findPositionOnTop(transaction, stageId, cardId)
          : await this.findPositionAfter(transaction, stageId, previousCardId, cardId);
      await transaction.pipelineCard.update({ where: { id: cardId }, data: { stageId, position, ...closing } });
    });
  }

  async removeCard(cardId: string): Promise<void> {
    await this.prisma.pipelineCard.delete({ where: { id: cardId } });
  }

  private async findPositionOnTop(transaction: DatabaseTransaction, stageId: string, movingCardId: string | null): Promise<number> {
    const firstCard = await transaction.pipelineCard.findFirst({
      where: { stageId, ...(movingCardId !== null && { id: { not: movingCardId } }) },
      orderBy: [{ position: 'asc' }, { id: 'asc' }],
      select: { position: true },
    });
    return firstCard ? firstCard.position - CARD_POSITION_GAP : CARD_POSITION_GAP;
  }

  private async findPositionAfter(
    transaction: DatabaseTransaction,
    stageId: string,
    previousCardId: string,
    movingCardId: string,
  ): Promise<number> {
    const previousCard = await transaction.pipelineCard.findUniqueOrThrow({ where: { id: previousCardId }, select: { position: true } });
    const nextCard = await this.findCardAfter(transaction, stageId, previousCard.position, movingCardId);
    if (!nextCard) return previousCard.position + CARD_POSITION_GAP;
    if (nextCard.position - previousCard.position > SMALLEST_GAP_BEFORE_RENUMBERING) {
      return (previousCard.position + nextCard.position) / 2;
    }
    await this.renumberStage(transaction, stageId);
    return await this.findPositionAfter(transaction, stageId, previousCardId, movingCardId);
  }

  private async findCardAfter(transaction: DatabaseTransaction, stageId: string, position: number, movingCardId: string) {
    return await transaction.pipelineCard.findFirst({
      where: { stageId, position: { gt: position }, id: { not: movingCardId } },
      orderBy: [{ position: 'asc' }, { id: 'asc' }],
      select: { position: true },
    });
  }

  private async renumberStage(transaction: DatabaseTransaction, stageId: string): Promise<void> {
    await transaction.$executeRaw`
      UPDATE "PipelineCard" AS card
      SET "position" = ${CARD_POSITION_GAP} * ordered."rowNumber"
      FROM (
        SELECT "id", ROW_NUMBER() OVER (ORDER BY "position" ASC, "id" ASC) AS "rowNumber"
        FROM "PipelineCard" WHERE "stageId" = ${stageId}::uuid
      ) AS ordered
      WHERE card."id" = ordered."id"`;
  }
}
