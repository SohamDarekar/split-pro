import { SendHorizontal, Trash2 } from 'lucide-react';
import { type NextPage } from 'next';
import React, { useCallback, useState } from 'react';
import { toast } from 'sonner';

import { useTranslationWithUtils } from '~/hooks/useTranslationWithUtils';
import { api } from '~/utils/api';

import { EntityAvatar } from '../ui/avatar';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

interface ExpenseCommentsProps {
  expenseId: string;
  userId: number;
  readOnly?: boolean;
}

const MAX_COMMENT_LENGTH = 1000;

export const ExpenseComments: NextPage<ExpenseCommentsProps> = ({
  expenseId,
  userId,
  readOnly,
}) => {
  const { t, displayName, toUIDate } = useTranslationWithUtils();
  const [text, setText] = useState('');

  const apiUtils = api.useUtils();
  const detailsQuery = api.expense.getExpenseDetails.useQuery(
    { expenseId },
    { refetchInterval: 15_000 },
  );
  const addComment = api.expense.addComment.useMutation();
  const deleteComment = api.expense.deleteComment.useMutation();

  const comments = detailsQuery.data?.expenseNotes ?? [];

  const onChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setText(e.target.value);
  }, []);

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const note = text.trim();
      if ('' === note) {
        return;
      }

      try {
        await addComment.mutateAsync({ expenseId, note });
        setText('');
        await apiUtils.expense.getExpenseDetails.invalidate({ expenseId });
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : t('expense_details.comments.send_failed'),
        );
      }
    },
    [text, addComment, expenseId, apiUtils, t],
  );

  const onDelete = useCallback(
    async (commentId: string) => {
      try {
        await deleteComment.mutateAsync({ commentId });
        await apiUtils.expense.getExpenseDetails.invalidate({ expenseId });
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : t('expense_details.comments.send_failed'),
        );
      }
    },
    [deleteComment, apiUtils, expenseId, t],
  );

  return (
    <div className="mt-6 flex flex-col gap-3">
      <p className="text-sm text-gray-500">{t('expense_details.comments.title')}</p>
      {0 === comments.length ? (
        <p className="text-sm text-gray-400">{t('expense_details.comments.empty')}</p>
      ) : (
        comments.map((comment) => (
          <div key={comment.id} className="flex items-start gap-3">
            <EntityAvatar entity={comment.createdBy} size={30} />
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span>{displayName(comment.createdBy, userId)}</span>
                <span>{toUIDate(comment.createdAt, { time: true })}</span>
              </div>
              <p className="text-sm break-words whitespace-pre-wrap">{comment.note}</p>
            </div>
            {comment.createdById === userId ? (
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                aria-label={t('expense_details.comments.delete')}
                onClick={() => onDelete(comment.id)}
              >
                <Trash2 className="size-4 text-gray-400" />
              </Button>
            ) : null}
          </div>
        ))
      )}
      {readOnly ? null : (
        <form onSubmit={onSubmit} className="flex items-center gap-2">
          <Input
            value={text}
            onChange={onChange}
            maxLength={MAX_COMMENT_LENGTH}
            placeholder={t('expense_details.comments.placeholder')}
          />
          <Button type="submit" size="icon" disabled={'' === text.trim() || addComment.isPending}>
            <SendHorizontal className="size-4" />
          </Button>
        </form>
      )}
    </div>
  );
};
