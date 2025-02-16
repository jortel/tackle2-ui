import React, { useCallback, useEffect, useState } from "react";
import { AxiosError, AxiosResponse } from "axios";
import { useTranslation } from "react-i18next";

import {
  Button,
  ButtonVariant,
  ToolbarChip,
  ToolbarGroup,
  ToolbarItem,
} from "@patternfly/react-core";
import {
  cellWidth,
  ICell,
  IRow,
  sortable,
  TableText,
} from "@patternfly/react-table";

import { useDispatch } from "react-redux";
import { alertActions } from "@app/store/alert";
import { confirmDialogActions } from "@app/store/confirmDialog";

import {
  AppPlaceholder,
  ConditionalRender,
  AppTableWithControls,
  SearchFilter,
  AppTableActionButtons,
  AppTableToolbarToggleGroup,
  NoDataEmptyState,
} from "@app/shared/components";

import { BusinessService, Identity, SortByQuery } from "@app/api/models";
import { deleteBusinessService } from "@app/api/rest";
import { getAxiosErrorMessage } from "@app/utils/utils";

import { NewBusinessServiceModal } from "./components/new-business-service-modal";
import { UpdateBusinessServiceModal } from "./components/update-business-service-modal";
import { usePaginationState } from "@app/shared/hooks/usePaginationState";
import {
  FilterCategory,
  FilterToolbar,
  FilterType,
} from "@app/shared/components/FilterToolbar";
import { useFilterState } from "@app/shared/hooks/useFilterState";
import { useSortState } from "@app/shared/hooks/useSortState";
import { controlsWriteScopes, RBAC, RBAC_TYPE } from "@app/rbac";
import { useFetchApplications } from "@app/queries/applications";
import {
  useDeleteBusinessServiceMutation,
  useFetchBusinessServices,
} from "@app/queries/businessservices";

const ENTITY_FIELD = "entity";

// const getRow = (rowData: IRowData): BusinessService => {
//   return rowData[ENTITY_FIELD];
// };

export const BusinessServices: React.FC = () => {
  const { t } = useTranslation();
  const dispatch = useDispatch();

  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [rowToUpdate, setRowToUpdate] = useState<BusinessService>();

  const onDeleteBusinessServiceSuccess = (response: any) => {
    dispatch(confirmDialogActions.closeDialog());
  };

  const onDeleteBusinessServiceError = (error: AxiosError) => {
    dispatch(confirmDialogActions.closeDialog());
    dispatch(alertActions.addDanger(getAxiosErrorMessage(error)));
  };

  const { mutate: deleteBusinessService } = useDeleteBusinessServiceMutation(
    onDeleteBusinessServiceSuccess,
    onDeleteBusinessServiceError
  );

  const { businessServices, isFetching, fetchError, refetch } =
    useFetchBusinessServices();

  const { applications } = useFetchApplications();

  const filterCategories: FilterCategory<BusinessService>[] = [
    {
      key: "name",
      title: t("terms.name"),
      type: FilterType.search,
      placeholderText:
        t("actions.filterBy", {
          what: t("terms.name").toLowerCase(),
        }) + "...",
      getItemValue: (item) => {
        return item?.name || "";
      },
    },
    {
      key: "description",
      title: t("terms.description"),
      type: FilterType.search,
      placeholderText:
        t("actions.filterBy", {
          what: t("terms.description").toLowerCase(),
        }) + "...",
      getItemValue: (item) => {
        return item.description || "";
      },
    },
    {
      key: "owner",
      title: t("terms.createdBy"),
      type: FilterType.search,
      placeholderText:
        t("actions.filterBy", {
          what: t("terms.owner").toLowerCase(),
        }) + "...",
      getItemValue: (item) => {
        return item.owner?.name || "";
      },
    },
  ];

  const { filterValues, setFilterValues, filteredItems } = useFilterState(
    businessServices || [],
    filterCategories
  );
  const getSortValues = (businessService: BusinessService) => [
    businessService?.name || "",
    businessService?.description || "",
    businessService.owner?.name || "",
    "", // Action column
  ];

  const { sortBy, onSort, sortedItems } = useSortState(
    filteredItems,
    getSortValues
  );

  const { currentPageItems, setPageNumber, paginationProps } =
    usePaginationState(sortedItems, 10);

  const columns: ICell[] = [
    { title: t("terms.name"), transforms: [sortable, cellWidth(25)] },
    { title: t("terms.description"), transforms: [cellWidth(40)] },
    { title: t("terms.owner"), transforms: [sortable] },
    {
      title: "",
      props: {
        className: "pf-u-text-align-right",
      },
    },
  ];

  const rows: IRow[] = [];
  currentPageItems?.forEach((item) => {
    const isAssignedToApplication = applications.some(
      (app) => app.businessService?.id === item.id
    );
    rows.push({
      [ENTITY_FIELD]: item,
      cells: [
        {
          title: <TableText wrapModifier="truncate">{item.name}</TableText>,
        },
        {
          title: (
            <TableText wrapModifier="truncate">{item.description}</TableText>
          ),
        },
        {
          title: (
            <TableText wrapModifier="truncate">{item.owner?.name}</TableText>
          ),
        },
        {
          title: (
            <AppTableActionButtons
              isDeleteEnabled={isAssignedToApplication}
              tooltipMessage="Cannot remove a business service associated with application(s)"
              onEdit={() => editRow(item)}
              onDelete={() => deleteRow(item)}
            />
          ),
        },
      ],
    });
  });

  const editRow = (row: BusinessService) => {
    setRowToUpdate(row);
  };

  const deleteRow = (row: BusinessService) => {
    dispatch(
      confirmDialogActions.openDialog({
        // t("terms.businessService")
        title: t("dialog.title.delete", {
          what: t("terms.businessService").toLowerCase(),
        }),
        titleIconVariant: "warning",
        message: t("dialog.message.delete"),
        confirmBtnVariant: ButtonVariant.danger,
        confirmBtnLabel: t("actions.delete"),
        cancelBtnLabel: t("actions.cancel"),
        onConfirm: () => {
          dispatch(confirmDialogActions.processing());
          deleteBusinessService(row.id);
          if (currentPageItems.length === 1 && paginationProps.page) {
            setPageNumber(paginationProps.page - 1);
          } else {
            setPageNumber(1);
          }
        },
      })
    );
  };

  // Advanced filters

  const handleOnClearAllFilters = () => {
    setFilterValues({});
  };

  // Create Modal

  const handleOnOpenCreateNewBusinessServiceModal = () => {
    setIsNewModalOpen(true);
  };

  const handleOnBusinessServiceCreated = (
    response: AxiosResponse<BusinessService>
  ) => {
    setIsNewModalOpen(false);
    refetch();

    dispatch(
      alertActions.addSuccess(
        t("toastr.success.added", {
          what: response.data.name,
          type: "business service",
        })
      )
    );
  };

  const handleOnCancelCreateBusinessService = () => {
    setIsNewModalOpen(false);
  };

  // Update Modal

  const handleOnBusinessServiceUpdated = () => {
    setRowToUpdate(undefined);
    refetch();
  };

  const handleOnCancelUpdateBusinessService = () => {
    setRowToUpdate(undefined);
  };

  return (
    <>
      <ConditionalRender
        when={isFetching && !(businessServices || fetchError)}
        then={<AppPlaceholder />}
      >
        <AppTableWithControls
          count={businessServices ? businessServices.length : 0}
          paginationProps={paginationProps}
          paginationIdPrefix="business-services"
          sortBy={sortBy}
          onSort={onSort}
          cells={columns}
          rows={rows}
          isLoading={isFetching}
          loadingVariant="skeleton"
          fetchError={fetchError}
          toolbarClearAllFilters={handleOnClearAllFilters}
          toolbarToggle={
            <FilterToolbar<BusinessService>
              filterCategories={filterCategories}
              filterValues={filterValues}
              setFilterValues={setFilterValues}
            />
          }
          toolbarActions={
            <ToolbarGroup variant="button-group">
              <ToolbarItem>
                <RBAC
                  allowedPermissions={controlsWriteScopes}
                  rbacType={RBAC_TYPE.Scope}
                >
                  <Button
                    type="button"
                    aria-label="create-business-service"
                    variant={ButtonVariant.primary}
                    onClick={handleOnOpenCreateNewBusinessServiceModal}
                  >
                    {t("actions.createNew")}
                  </Button>
                </RBAC>
              </ToolbarItem>
            </ToolbarGroup>
          }
          noDataState={
            <NoDataEmptyState
              // t('terms.businessServices')
              title={t("composed.noDataStateTitle", {
                what: t("terms.businessServices").toLowerCase(),
              })}
              // t('terms.businessService')
              description={
                t("composed.noDataStateBody", {
                  what: t("terms.businessService").toLowerCase(),
                }) + "."
              }
            />
          }
        />
      </ConditionalRender>

      <NewBusinessServiceModal
        isOpen={isNewModalOpen}
        onSaved={handleOnBusinessServiceCreated}
        onCancel={handleOnCancelCreateBusinessService}
      />
      <UpdateBusinessServiceModal
        businessService={rowToUpdate}
        onSaved={handleOnBusinessServiceUpdated}
        onCancel={handleOnCancelUpdateBusinessService}
      />
    </>
  );
};
