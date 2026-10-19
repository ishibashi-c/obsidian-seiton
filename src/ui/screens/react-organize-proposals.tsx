/** @jsxImportSource react */

import { useEffect, useMemo, useRef, useState } from "react";
import { type Lang, type MessageKey, t } from "../../shared/i18n";
import {
  type OrganizationProposalDocument,
  type OrganizationProposalOperation,
  type OrganizationProposalOperationRef,
  organizationProposalCounts,
  organizationProposalOperationFingerprint,
  organizationProposalOperationIsApplied,
} from "../../shared/organizationProposal";
import { Alert, Badge, Button, Checkbox, Modal, Text } from "../primitives";

const TYPE_LABEL_KEYS: Record<string, MessageKey> = {
  article: "type.article",
  class: "type.class",
  collection: "type.collection",
  idea: "type.idea",
  memo: "type.memo",
  profile: "type.profile",
  project: "type.project",
  reading: "type.reading",
  task: "type.task",
  webclip: "type.webclip",
};

function statusLabel(lang: Lang, status: string): string {
  if (status === "inbox") {
    return t(lang, "organize.inbox");
  }
  if (status === "archive") {
    return t(lang, "organize.archive");
  }
  return t(lang, "library.activeContexts");
}

function typeLabel(lang: Lang, type: string): string {
  const key = TYPE_LABEL_KEYS[type];
  return key ? t(lang, key) : type;
}

function tagValue(values: readonly string[]): string {
  return values.length > 0
    ? values.map((value) => `#${value}`).join(" · ")
    : "—";
}

function listValue(values: readonly string[]): string {
  return values.length > 0 ? values.join(" · ") : "—";
}

function operationTargetFolder(
  operation: OrganizationProposalOperation,
  typeFolderPaths: Partial<Record<string, string>>
): string {
  if (operation.changes.status === "archive") {
    return operation.current?.archiveDestination ?? "";
  }
  if (operation.changes.destination) {
    return operation.changes.destination;
  }
  const type = operation.changes.type ?? operation.expected.type;
  if (type !== operation.expected.type) {
    return typeFolderPaths[type] ?? "";
  }
  return operation.current?.path.split("/").slice(0, -1).join("/") ?? "";
}

function operationKey(
  operation: Pick<
    OrganizationProposalOperationRef,
    "operationId" | "proposalPath"
  >
): string {
  return `${operation.proposalPath}:${operation.operationId}`;
}

function operationEntryKey(entry: {
  operation: OrganizationProposalOperation;
  proposalPath: string;
}): string {
  return operationKey({
    operationId: entry.operation.id,
    proposalPath: entry.proposalPath,
  });
}

export function ReactOrganizeProposals({
  lang,
  proposals,
  typeFolderPaths,
  applyingOperation,
  onApply,
  onApplyBatch,
  onOpen,
}: {
  lang: Lang;
  proposals: OrganizationProposalDocument[];
  typeFolderPaths: Partial<Record<string, string>>;
  applyingOperation?: string | null;
  onApply?: (
    operation: OrganizationProposalOperationRef
  ) => void | Promise<void>;
  onApplyBatch?: (
    operations: readonly OrganizationProposalOperationRef[]
  ) => Promise<{ appliedCount: number; failedCount: number }>;
  onOpen?: (path: string) => void | Promise<void>;
}) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [submittingBatch, setSubmittingBatch] = useState(false);
  const [batchError, setBatchError] = useState("");
  const confirmationTriggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    setPortalTarget(
      rootRef.current?.closest<HTMLElement>(".seiton-ui-root") ?? null
    );
  }, []);

  const selectableOperations = useMemo(
    () =>
      proposals.flatMap((proposal) =>
        proposal.status === "invalid"
          ? []
          : proposal.operations
              .filter(
                (operation) =>
                  !organizationProposalOperationIsApplied(
                    operation,
                    proposal
                  ) &&
                  operation.matchesExpected === true &&
                  Boolean(operation.current) &&
                  Boolean(operation.current?.contentFingerprint) &&
                  Boolean(onApplyBatch)
              )
              .map((operation) => ({
                fingerprint:
                  organizationProposalOperationFingerprint(operation),
                operation,
                proposalPath: proposal.path,
              }))
      ),
    [onApplyBatch, proposals]
  );
  const selectableKeys = useMemo(
    () => new Set(selectableOperations.map(operationEntryKey)),
    [selectableOperations]
  );
  const selectedOperations = selectableOperations.filter((entry) =>
    selected.has(operationEntryKey(entry))
  );
  const allSelected =
    selectableKeys.size > 0 &&
    selectedOperations.length === selectableKeys.size;

  useEffect(() => {
    setSelected((current) => {
      const next = new Set(
        [...current].filter((key) => selectableKeys.has(key))
      );
      return next.size === current.size ? current : next;
    });
  }, [selectableKeys]);

  if (proposals.length === 0) {
    return (
      <div className="react-organize-proposals-empty" role="status">
        <strong>{t(lang, "organize.proposalEmpty")}</strong>
      </div>
    );
  }

  const toggleOperation = (key: string, checked: boolean): void => {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(key);
      } else {
        next.delete(key);
      }
      return next;
    });
  };

  const toggleAll = (checked: boolean): void => {
    setSelected(checked ? new Set(selectableKeys) : new Set());
  };

  const applySelected = async (): Promise<void> => {
    if (!onApplyBatch || selectedOperations.length === 0 || submittingBatch) {
      return;
    }
    setBatchError("");
    setSubmittingBatch(true);
    try {
      await onApplyBatch(
        selectedOperations.map(({ proposalPath, operation }) => ({
          fingerprint: organizationProposalOperationFingerprint(operation),
          operationId: operation.id,
          proposalPath,
          sourceFingerprint: operation.current?.contentFingerprint ?? "",
        }))
      );
      setSelected(new Set());
      setConfirmationOpen(false);
    } catch {
      setBatchError(t(lang, "organize.proposalBatchUnexpectedError"));
    } finally {
      setSubmittingBatch(false);
    }
  };

  return (
    <div className="react-organize-proposals" ref={rootRef}>
      {onApplyBatch && selectableOperations.length > 0 ? (
        <div className="react-organize-proposal-bulkbar">
          <Checkbox
            checked={allSelected}
            label={t(lang, "organize.proposalSelectAll")}
            onChange={(event) => toggleAll(event.currentTarget.checked)}
          />
          <Text size="sm">
            {t(lang, "organize.proposalSelected", {
              count: `${selectedOperations.length}`,
            })}
          </Text>
          <Button
            color="accent"
            disabled={selectedOperations.length === 0}
            onClick={() => setConfirmationOpen(true)}
            ref={confirmationTriggerRef}
            size="sm"
          >
            {t(lang, "organize.proposalReviewSelected")}
          </Button>
        </div>
      ) : null}

      {proposals.map((proposal) => {
        const counts = organizationProposalCounts(proposal);
        return (
          <article className="react-organize-proposal" key={proposal.path}>
            <header className="react-organize-proposal-header">
              <div>
                <h3>{proposal.title}</h3>
                <Text size="sm">{proposal.path}</Text>
              </div>
              <div className="react-organize-proposal-header-actions">
                {onOpen ? (
                  <Button
                    onClick={() => void onOpen(proposal.path)}
                    variant="subtle"
                  >
                    {t(lang, "organize.proposalOpen")}
                  </Button>
                ) : null}
                <Badge
                  color={proposal.status === "applied" ? "ink" : "accent"}
                  variant={proposal.status === "applied" ? "outline" : "light"}
                >
                  {t(
                    lang,
                    proposal.status === "invalid"
                      ? "organize.proposalInvalid"
                      : proposal.status === "applied"
                        ? "organize.proposalApplied"
                        : proposal.status === "partial"
                          ? "organize.proposalPartial"
                          : counts.pendingCount === 0 &&
                              (counts.heldCount ?? 0) > 0
                            ? "organize.proposalHoldOnly"
                            : "organize.proposalPending"
                  )}
                </Badge>
              </div>
            </header>

            {proposal.status === "invalid" ? (
              <p className="react-organize-proposal-error" role="alert">
                {proposal.error ?? t(lang, "organize.proposalInvalid")}
              </p>
            ) : (
              <>
                <section
                  aria-label={t(lang, "organize.proposalSummary")}
                  className="react-organize-proposal-summary"
                >
                  <Badge color="ink" variant="outline">
                    {t(lang, "organize.proposalTargetCount", {
                      count:
                        counts.targetCount === null
                          ? "?"
                          : `${counts.targetCount}`,
                    })}
                  </Badge>
                  <Badge color="accent" variant="light">
                    {t(lang, "organize.proposalProposedCount", {
                      count: `${counts.proposedCount}`,
                    })}
                  </Badge>
                  {counts.heldCount === null ? (
                    <Badge color="gray" variant="outline">
                      {t(lang, "organize.proposalHeldUnknown")}
                    </Badge>
                  ) : (
                    <Badge color="gray" variant="outline">
                      {t(lang, "organize.proposalHeldCount", {
                        count: `${counts.heldCount}`,
                      })}
                    </Badge>
                  )}
                  {counts.appliedCount > 0 ? (
                    <Badge color="green" variant="light">
                      {t(lang, "organize.proposalAppliedCount", {
                        count: `${counts.appliedCount}`,
                      })}
                    </Badge>
                  ) : null}
                </section>

                {proposal.coverage === "legacy" ? (
                  <Alert color="gray" variant="light">
                    {t(lang, "organize.proposalLegacyCoverage")}
                  </Alert>
                ) : null}

                {proposal.operations.length > 0 ? (
                  <section
                    aria-label={t(lang, "organize.proposalProposedSection")}
                    className="react-organize-proposal-group"
                  >
                    <header className="react-organize-proposal-group-header">
                      <h4>{t(lang, "organize.proposalProposedSection")}</h4>
                      <Text size="sm">
                        {t(lang, "organize.proposalPendingCount", {
                          count: `${counts.pendingCount}`,
                        })}
                      </Text>
                    </header>
                    <div className="react-organize-proposal-operations">
                      {proposal.operations.map((operation) => {
                        const current = operation.current;
                        const result = proposal.results[operation.id];
                        const tags =
                          operation.changes.tags ??
                          current?.tags ??
                          operation.expected.tags;
                        const lists =
                          operation.changes.lists ??
                          current?.lists ??
                          operation.expected.lists;
                        const type =
                          operation.changes.type ?? operation.expected.type;
                        const targetFolder = operationTargetFolder(
                          operation,
                          typeFolderPaths
                        );
                        const ref = {
                          fingerprint:
                            organizationProposalOperationFingerprint(operation),
                          operationId: operation.id,
                          proposalPath: proposal.path,
                          sourceFingerprint: current?.contentFingerprint ?? "",
                        };
                        const key = operationKey(ref);
                        const canApply =
                          !organizationProposalOperationIsApplied(
                            operation,
                            proposal
                          ) &&
                          operation.matchesExpected === true &&
                          Boolean(current) &&
                          Boolean(current?.contentFingerprint) &&
                          Boolean(onApply);
                        const canSelect = selectableKeys.has(key);
                        const operationName =
                          current?.title ?? operation.source;

                        return (
                          <article
                            className="react-organize-proposal-operation"
                            key={operation.id}
                          >
                            <div className="react-organize-proposal-operation-heading">
                              {canSelect ? (
                                <Checkbox
                                  aria-label={t(
                                    lang,
                                    "organize.proposalSelectItem",
                                    { title: operationName }
                                  )}
                                  checked={selected.has(key)}
                                  onChange={(event) =>
                                    toggleOperation(
                                      key,
                                      event.currentTarget.checked
                                    )
                                  }
                                />
                              ) : null}
                              <div className="react-organize-proposal-operation-title">
                                <strong>{operationName}</strong>
                                <Text size="xs">{operation.source}</Text>
                              </div>
                              {organizationProposalOperationIsApplied(
                                operation,
                                proposal
                              ) ? (
                                <Badge color="green" variant="light">
                                  {t(lang, "organize.proposalApplied")}
                                </Badge>
                              ) : operation.matchesExpected === false ? (
                                <Badge color="red" variant="light">
                                  {t(lang, "organize.proposalStale")}
                                </Badge>
                              ) : result?.status === "blocked" ? (
                                <Badge color="red" variant="light">
                                  {result.message ??
                                    t(lang, "organize.proposalApplyFailed")}
                                </Badge>
                              ) : null}
                            </div>

                            <div className="react-organize-proposal-route">
                              <span>
                                {current
                                  ? `${typeLabel(lang, current.type)} · ${statusLabel(lang, current.status)}`
                                  : t(lang, "organize.proposalMissingSource")}
                              </span>
                              <span aria-hidden="true">→</span>
                              <span>
                                {`${typeLabel(lang, type)} · ${statusLabel(lang, operation.changes.status)}`}
                              </span>
                              {targetFolder ? (
                                <span className="react-organize-proposal-route-path">
                                  {targetFolder}
                                </span>
                              ) : null}
                            </div>

                            {operation.reason ? (
                              <p className="react-organize-proposal-reason">
                                {operation.reason}
                              </p>
                            ) : null}

                            {current ? (
                              <details className="react-organize-proposal-details">
                                <summary>
                                  {t(lang, "organize.proposalShowDetails")}
                                </summary>
                                <div className="react-organize-proposal-change-grid">
                                  <div>
                                    <span>
                                      {t(lang, "organize.proposalCurrent")}
                                    </span>
                                    <p>
                                      <span>{t(lang, "edit.tags")}</span>
                                      {tagValue(current.tags)}
                                    </p>
                                    <p>
                                      <span>{t(lang, "organize.lists")}</span>
                                      {listValue(current.lists)}
                                    </p>
                                  </div>
                                  <div>
                                    <span>
                                      {t(lang, "organize.proposalAfter")}
                                    </span>
                                    <p>
                                      <span>{t(lang, "edit.tags")}</span>
                                      {tagValue(tags)}
                                    </p>
                                    <p>
                                      <span>{t(lang, "organize.lists")}</span>
                                      {listValue(lists)}
                                    </p>
                                  </div>
                                </div>
                                {current.body ? (
                                  <pre className="react-organize-proposal-body">
                                    {current.body}
                                  </pre>
                                ) : null}
                              </details>
                            ) : (
                              <p
                                className="react-organize-proposal-error"
                                role="alert"
                              >
                                {t(lang, "organize.proposalMissingSource")}
                              </p>
                            )}

                            <footer className="react-organize-proposal-actions">
                              {onOpen ? (
                                <Button
                                  onClick={() => void onOpen(operation.source)}
                                  variant="subtle"
                                >
                                  {t(lang, "organize.proposalOpenSource")}
                                </Button>
                              ) : null}
                              {onApply &&
                              !organizationProposalOperationIsApplied(
                                operation,
                                proposal
                              ) ? (
                                <Button
                                  color="ink"
                                  disabled={
                                    !canApply || Boolean(applyingOperation)
                                  }
                                  loading={applyingOperation === key}
                                  onClick={() => void onApply(ref)}
                                >
                                  {t(lang, "organize.proposalApply")}
                                </Button>
                              ) : null}
                            </footer>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                ) : null}

                {proposal.holds.length > 0 ? (
                  <section
                    aria-label={t(lang, "organize.proposalHeldSection")}
                    className="react-organize-proposal-group react-organize-proposal-held"
                  >
                    <header className="react-organize-proposal-group-header">
                      <h4>{t(lang, "organize.proposalHeldSection")}</h4>
                      <Text size="sm">
                        {t(lang, "organize.proposalHeldCount", {
                          count: `${proposal.holds.length}`,
                        })}
                      </Text>
                    </header>
                    <ul className="react-organize-proposal-holds">
                      {proposal.holds.map((hold) => (
                        <li key={hold.source}>
                          <div>
                            <strong>
                              {hold.current?.title ?? hold.title ?? hold.source}
                            </strong>
                            <Text size="xs">{hold.source}</Text>
                          </div>
                          <p>{hold.reason}</p>
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}
              </>
            )}
          </article>
        );
      })}

      {portalTarget ? (
        <Modal
          closeButtonProps={{ "aria-label": t(lang, "notify.close") }}
          onClose={() => setConfirmationOpen(false)}
          opened={confirmationOpen}
          portalProps={{ target: portalTarget }}
          returnFocusRef={confirmationTriggerRef}
          title={t(lang, "organize.proposalConfirmTitle", {
            count: `${selectedOperations.length}`,
          })}
        >
          <div className="react-organize-proposal-confirmation">
            <p>{t(lang, "organize.proposalConfirmDescription")}</p>
            <Alert color="gray" variant="light">
              {t(lang, "organize.proposalConfirmSafety")}
            </Alert>
            {batchError ? (
              <Alert color="red" role="alert" variant="light">
                {batchError}
              </Alert>
            ) : null}
            <ul>
              {selectedOperations.map(({ operation, proposalPath }) => (
                <li
                  key={operationKey({
                    operationId: operation.id,
                    proposalPath,
                  })}
                >
                  <strong>
                    {operation.current?.title ?? operation.source}
                  </strong>
                  <span>
                    {`${operation.source} → ${operationTargetFolder(operation, typeFolderPaths)}`}
                  </span>
                  {operation.current ? (
                    <>
                      <span>
                        {`${typeLabel(lang, operation.current.type)} · ${statusLabel(lang, operation.current.status)} → ${typeLabel(lang, operation.changes.type ?? operation.expected.type)} · ${statusLabel(lang, operation.changes.status)}`}
                      </span>
                      <small>
                        {t(lang, "organize.proposalTagChanges", {
                          after: tagValue(
                            operation.changes.tags ?? operation.current.tags
                          ),
                          before: tagValue(operation.current.tags),
                        })}
                      </small>
                      <small>
                        {t(lang, "organize.proposalListChanges", {
                          after: listValue(
                            operation.changes.lists ?? operation.current.lists
                          ),
                          before: listValue(operation.current.lists),
                        })}
                      </small>
                    </>
                  ) : null}
                  {operation.reason ? <small>{operation.reason}</small> : null}
                </li>
              ))}
            </ul>
            <div className="react-organize-proposal-confirmation-actions">
              <Button
                disabled={submittingBatch}
                onClick={() => setConfirmationOpen(false)}
                variant="default"
              >
                {t(lang, "organize.proposalCancel")}
              </Button>
              <Button
                color="accent"
                disabled={submittingBatch || selectedOperations.length === 0}
                loading={submittingBatch}
                onClick={() => void applySelected()}
              >
                {t(lang, "organize.proposalApplySelected", {
                  count: `${selectedOperations.length}`,
                })}
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
