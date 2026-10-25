import mongoose, { Schema, Model } from 'mongoose';

export interface ISuggestionItem {
  itemId: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  isDefault: boolean;
  globalPopularityScore: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IUserAction {
  userId: string;
  itemId: string;
  actionType: 'view' | 'click' | 'generate' | 'refine' | 'deploy';
  category: string;
  tags?: string[];
  timestamp: Date;
}

// 1. Suggestion Item Catalog Schema
const SuggestionItemSchema = new Schema<ISuggestionItem>(
  {
    itemId: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    category: { type: String, required: true, index: true },
    tags: [{ type: String, index: true }],
    isDefault: { type: Boolean, default: false, index: true },
    globalPopularityScore: { type: Number, default: 0, index: true },
  },
  { timestamps: true }
);

// 2. User Action Log Schema (Time-Decayed History)
const UserActionSchema = new Schema<IUserAction>(
  {
    userId: { type: String, required: true, index: true },
    itemId: { type: String, required: true, index: true },
    actionType: {
      type: String,
      enum: ['view', 'click', 'generate', 'refine', 'deploy'],
      required: true,
    },
    category: { type: String, required: true },
    tags: [{ type: String }],
    timestamp: { type: Date, default: Date.now, index: true },
  }
);

// Compound indexes for fast time-window queries & user aggregations
UserActionSchema.index({ userId: 1, timestamp: -1 });
UserActionSchema.index({ userId: 1, itemId: 1 });

export const SuggestionItemModel: Model<ISuggestionItem> =
  mongoose.models.SuggestionItem ||
  mongoose.model<ISuggestionItem>('SuggestionItem', SuggestionItemSchema);

export const UserActionModel: Model<IUserAction> =
  mongoose.models.UserAction ||
  mongoose.model<IUserAction>('UserAction', UserActionSchema);
