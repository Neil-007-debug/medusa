import { MedusaError } from "medusa-core-utils"
import { EntityManager } from "typeorm"

import { MedusaError } from "medusa-core-utils"
import { TransactionBaseService } from "../interfaces"
import { SalesChannel } from "../models"
import { SalesChannelRepository } from "../repositories/sales-channel"
import { FindConfig, QuerySelector } from "../types/common"
import {
  CreateSalesChannelInput,
  UpdateSalesChannelInput,
} from "../types/sales-channels"
import EventBusService from "./event-bus"
import { buildQuery } from "../utils"
import { PostgresError } from "../utils/exception-formatter"

type InjectedDependencies = {
  salesChannelRepository: typeof SalesChannelRepository
  eventBusService: EventBusService
  manager: EntityManager
}

class SalesChannelService extends TransactionBaseService<SalesChannelService> {
  static Events = {
    UPDATED: "sales_channel.updated",
  }

  protected manager_: EntityManager
  protected transactionManager_: EntityManager | undefined

  protected readonly salesChannelRepository_: typeof SalesChannelRepository
  protected readonly eventBusService_: EventBusService

  constructor({
    salesChannelRepository,
    eventBusService,
    manager,
  }: InjectedDependencies) {
    // eslint-disable-next-line prefer-rest-params
    super(arguments[0])

    this.manager_ = manager
    this.salesChannelRepository_ = salesChannelRepository
    this.eventBusService_ = eventBusService
  }

  /**
   * Retrieve a SalesChannel by id
   *
   * @experimental This feature is under development and may change in the future.
   * To use this feature please enable the corresponding feature flag in your medusa backend project.
   * @returns a sales channel
   */
  async retrieve(
    salesChannelId: string,
    config: FindConfig<SalesChannel> = {}
  ): Promise<SalesChannel | never> {
    return await this.atomicPhase_(async (manager) => {
      const salesChannelRepo = manager.getCustomRepository(
        this.salesChannelRepository_
      )

      const query = buildQuery(
        {
          id: salesChannelId,
        },
        config
      )

      const salesChannel = await salesChannelRepo.findOne(query)

      if (!salesChannel) {
        throw new MedusaError(
          MedusaError.Types.NOT_FOUND,
          `Sales channel with id ${salesChannelId} was not found`
        )
      }

      return salesChannel
    })
  }

  async listAndCount(
    selector: QuerySelector<any> = {},
    config: FindConfig<any> = { relations: [], skip: 0, take: 10 }
  ): Promise<[SalesChannel[], number]> {
    throw new Error("Method not implemented.")
  }

  /**
   * Creates a SalesChannel
   *
   * @experimental This feature is under development and may change in the future.
   * To use this feature please enable the corresponding feature flag in your medusa backend project.
   * @returns the created channel
   */
  async create(data: CreateSalesChannelInput): Promise<SalesChannel | never> {
    return await this.atomicPhase_(
      async (manager) => {
        const salesChannelRepo: SalesChannelRepository =
          manager.getCustomRepository(this.salesChannelRepository_)

        const salesChannel = salesChannelRepo.create(data)
        return await salesChannelRepo.save(salesChannel)
      },
      async (err: { code: string }) => {
        if (err.code === PostgresError.DUPLICATE_ERROR) {
          throw new MedusaError(
            MedusaError.Types.DUPLICATE_ERROR,
            `some message`
          )
        }
      }
    )
  }

  async update(
    salesChannelId: string,
    data: UpdateSalesChannelInput
  ): Promise<SalesChannel | never> {
    return await this.atomicPhase_(async (transactionManager) => {
      const salesChannelRepo: SalesChannelRepository =
        transactionManager.getCustomRepository(this.salesChannelRepository_)

      const salesChannel = await this.retrieve(salesChannelId)

      for (const key of Object.keys(data)) {
        if (typeof data[key] !== `undefined`) {
          salesChannel[key] = data[key]
        }
      }

      const result = await salesChannelRepo.save(salesChannel)

      await this.eventBusService_
        .withTransaction(transactionManager)
        .emit(SalesChannelService.Events.UPDATED, {
          id: result.id,
        })

      return result
    })
  }

  async delete(id: string): Promise<void> {
    throw new Error("Method not implemented.")
  }
}

export default SalesChannelService