
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "bill_lines": {
                  Row: {
                    "added_by_hand": boolean,"amount_paise": number,"bill_id": string,"category": Database["public"]['Enums']["bill_category"],"confidence": number | null,"created_at": string,"id": string,"label": string,"raw_text": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "added_by_hand"?: boolean,"amount_paise": number,"bill_id": string,"category"?: Database["public"]['Enums']["bill_category"],"confidence"?: number | null,"created_at"?: string,"id"?: string,"label"?: string,"raw_text"?: string,"updated_at"?: string
                  }
                  Update: {
                    "added_by_hand"?: boolean,"amount_paise"?: number,"bill_id"?: string,"category"?: Database["public"]['Enums']["bill_category"],"confidence"?: number | null,"created_at"?: string,"id"?: string,"label"?: string,"raw_text"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "bill_lines_bill_id_fkey"
      columns: ["bill_id"]
isOneToOne: false
      referencedRelation: "bills"
      referencedColumns: ["id"]
    }
                  ]
                },"bills": {
                  Row: {
                    "created_at": string,"extras_paise": number,"id": string,"image_paths": (string)[],"kitty_id": string,"mismatch_paise": number | null,"raw_result": Json | null,"scan_cost_usd": number | null,"scan_input_tokens": number | null,"scan_model": string | null,"scan_output_tokens": number | null,"status": Database["public"]['Enums']["bill_status"],"total_paise": number | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"extras_paise"?: number,"id"?: string,"image_paths"?: (string)[],"kitty_id": string,"mismatch_paise"?: number | null,"raw_result"?: Json | null,"scan_cost_usd"?: number | null,"scan_input_tokens"?: number | null,"scan_model"?: string | null,"scan_output_tokens"?: number | null,"status"?: Database["public"]['Enums']["bill_status"],"total_paise"?: number | null,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"extras_paise"?: number,"id"?: string,"image_paths"?: (string)[],"kitty_id"?: string,"mismatch_paise"?: number | null,"raw_result"?: Json | null,"scan_cost_usd"?: number | null,"scan_input_tokens"?: number | null,"scan_model"?: string | null,"scan_output_tokens"?: number | null,"status"?: Database["public"]['Enums']["bill_status"],"total_paise"?: number | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "bills_kitty_id_fkey"
      columns: ["kitty_id"]
isOneToOne: false
      referencedRelation: "kitties"
      referencedColumns: ["id"]
    }
                  ]
                },"device_tokens": {
                  Row: {
                    "created_at": string,"expo_push_token": string,"id": string,"platform": string,"profile_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"expo_push_token": string,"id"?: string,"platform": string,"profile_id": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"expo_push_token"?: string,"id"?: string,"platform"?: string,"profile_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "device_tokens_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"kitties": {
                  Row: {
                    "amount_source": Database["public"]['Enums']["amount_source"],"closed_at": string | null,"created_at": string,"due_date": string,"final_bill_paise": number | null,"goal_plan": Database["public"]['Enums']["goal_plan"] | null,"id": string,"kind": Database["public"]['Enums']["kitty_kind"],"organiser_id": string,"parts_count": number | null,"remind_day_before": boolean,"remind_on_day": boolean,"share_slug": string,"shared_at": string | null,"status": Database["public"]['Enums']["kitty_status"],"title": string,"total_paise": number,"updated_at": string,"upi_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_source"?: Database["public"]['Enums']["amount_source"],"closed_at"?: string | null,"created_at"?: string,"due_date": string,"final_bill_paise"?: number | null,"goal_plan"?: Database["public"]['Enums']["goal_plan"] | null,"id"?: string,"kind": Database["public"]['Enums']["kitty_kind"],"organiser_id": string,"parts_count"?: number | null,"remind_day_before"?: boolean,"remind_on_day"?: boolean,"share_slug"?: string,"shared_at"?: string | null,"status"?: Database["public"]['Enums']["kitty_status"],"title": string,"total_paise": number,"updated_at"?: string,"upi_id": string
                  }
                  Update: {
                    "amount_source"?: Database["public"]['Enums']["amount_source"],"closed_at"?: string | null,"created_at"?: string,"due_date"?: string,"final_bill_paise"?: number | null,"goal_plan"?: Database["public"]['Enums']["goal_plan"] | null,"id"?: string,"kind"?: Database["public"]['Enums']["kitty_kind"],"organiser_id"?: string,"parts_count"?: number | null,"remind_day_before"?: boolean,"remind_on_day"?: boolean,"share_slug"?: string,"shared_at"?: string | null,"status"?: Database["public"]['Enums']["kitty_status"],"title"?: string,"total_paise"?: number,"updated_at"?: string,"upi_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "kitties_organiser_id_fkey"
      columns: ["organiser_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"member_claims": {
                  Row: {
                    "claim_token": string,"claimed_at": string,"created_at": string,"id": string,"member_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "claim_token": string,"claimed_at"?: string,"created_at"?: string,"id"?: string,"member_id": string,"updated_at"?: string
                  }
                  Update: {
                    "claim_token"?: string,"claimed_at"?: string,"created_at"?: string,"id"?: string,"member_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "member_claims_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    }
                  ]
                },"members": {
                  Row: {
                    "created_at": string,"diet": Database["public"]['Enums']["diet"],"drinks": boolean,"final_share_paise": number | null,"id": string,"is_organiser": boolean,"kitty_id": string,"last_opened_at": string | null,"name": string,"paid_by_member_id": string | null,"phone": string | null,"refund_upi_id": string | null,"share_fixed": boolean,"share_paise": number,"sort_order": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"diet"?: Database["public"]['Enums']["diet"],"drinks"?: boolean,"final_share_paise"?: number | null,"id"?: string,"is_organiser"?: boolean,"kitty_id": string,"last_opened_at"?: string | null,"name": string,"paid_by_member_id"?: string | null,"phone"?: string | null,"refund_upi_id"?: string | null,"share_fixed"?: boolean,"share_paise"?: number,"sort_order"?: number,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"diet"?: Database["public"]['Enums']["diet"],"drinks"?: boolean,"final_share_paise"?: number | null,"id"?: string,"is_organiser"?: boolean,"kitty_id"?: string,"last_opened_at"?: string | null,"name"?: string,"paid_by_member_id"?: string | null,"phone"?: string | null,"refund_upi_id"?: string | null,"share_fixed"?: boolean,"share_paise"?: number,"sort_order"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "members_kitty_id_fkey"
      columns: ["kitty_id"]
isOneToOne: false
      referencedRelation: "kitties"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "members_paid_by_member_id_fkey"
      columns: ["paid_by_member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "body": string,"created_at": string,"dedupe_key": string | null,"id": string,"kind": string,"kitty_id": string | null,"member_id": string | null,"profile_id": string,"read_at": string | null,"title": string,"updated_at": string,"url": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"created_at"?: string,"dedupe_key"?: string | null,"id"?: string,"kind": string,"kitty_id"?: string | null,"member_id"?: string | null,"profile_id": string,"read_at"?: string | null,"title": string,"updated_at"?: string,"url"?: string | null
                  }
                  Update: {
                    "body"?: string,"created_at"?: string,"dedupe_key"?: string | null,"id"?: string,"kind"?: string,"kitty_id"?: string | null,"member_id"?: string | null,"profile_id"?: string,"read_at"?: string | null,"title"?: string,"updated_at"?: string,"url"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_kitty_id_fkey"
      columns: ["kitty_id"]
isOneToOne: false
      referencedRelation: "kitties"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"payments": {
                  Row: {
                    "amount_paise": number,"confirmed_at": string | null,"created_at": string,"direction": Database["public"]['Enums']["payment_direction"],"due_date": string | null,"id": string,"kind": Database["public"]['Enums']["payment_kind"],"kitty_id": string,"marked_at": string | null,"member_id": string,"status": Database["public"]['Enums']["payment_status"],"updated_at": string,"upi_ref": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "amount_paise": number,"confirmed_at"?: string | null,"created_at"?: string,"direction": Database["public"]['Enums']["payment_direction"],"due_date"?: string | null,"id"?: string,"kind": Database["public"]['Enums']["payment_kind"],"kitty_id": string,"marked_at"?: string | null,"member_id": string,"status"?: Database["public"]['Enums']["payment_status"],"updated_at"?: string,"upi_ref"?: string | null
                  }
                  Update: {
                    "amount_paise"?: number,"confirmed_at"?: string | null,"created_at"?: string,"direction"?: Database["public"]['Enums']["payment_direction"],"due_date"?: string | null,"id"?: string,"kind"?: Database["public"]['Enums']["payment_kind"],"kitty_id"?: string,"marked_at"?: string | null,"member_id"?: string,"status"?: Database["public"]['Enums']["payment_status"],"updated_at"?: string,"upi_ref"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "payments_kitty_id_fkey"
      columns: ["kitty_id"]
isOneToOne: false
      referencedRelation: "kitties"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "payments_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"id": string,"name": string,"phone": string | null,"updated_at": string,"upi_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id": string,"name"?: string,"phone"?: string | null,"updated_at"?: string,"upi_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"name"?: string,"phone"?: string | null,"updated_at"?: string,"upi_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "apply_scanned_shares":
{ Args: { "p_bill_id": string,"p_kitty_id": string,"p_shares": Json }; Returns: undefined
                           },
"close_kitty":
{ Args: { "p_kitty_id": string,"p_write_off"?: boolean }; Returns: undefined
                           },
"create_kitty":
{ Args: { "p_due_date": string,"p_goal_plan"?: Database["public"]['Enums']["goal_plan"],"p_kind": Database["public"]['Enums']["kitty_kind"],"p_members": Json,"p_parts_count"?: number,"p_title": string,"p_total_paise": number,"p_upi_id": string }; Returns: {
              "amount_source": Database["public"]['Enums']["amount_source"],
"closed_at": string | null,
"created_at": string,
"due_date": string,
"final_bill_paise": number | null,
"goal_plan": Database["public"]['Enums']["goal_plan"] | null,
"id": string,
"kind": Database["public"]['Enums']["kitty_kind"],
"organiser_id": string,
"parts_count": number | null,
"remind_day_before": boolean,
"remind_on_day": boolean,
"share_slug": string,
"shared_at": string | null,
"status": Database["public"]['Enums']["kitty_status"],
"title": string,
"total_paise": number,
"updated_at": string,
"upi_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "kitties"
        isOneToOne: true
        isSetofReturn: false
      } },
"generate_share_slug":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"register_device_token":
{ Args: { "p_platform": string,"p_token": string }; Returns: undefined
                           },
"settle_kitty":
{ Args: { "p_final_bill_paise": number,"p_kitty_id": string,"p_shares": Json }; Returns: undefined
                           },
"share_kitty":
{ Args: { "p_kitty_id": string }; Returns: string
                           },
"update_kitty":
{ Args: { "p_due_date": string,"p_goal_plan"?: Database["public"]['Enums']["goal_plan"],"p_kind": Database["public"]['Enums']["kitty_kind"],"p_kitty_id": string,"p_members": Json,"p_parts_count"?: number,"p_title": string,"p_total_paise": number,"p_upi_id": string }; Returns: {
              "amount_source": Database["public"]['Enums']["amount_source"],
"closed_at": string | null,
"created_at": string,
"due_date": string,
"final_bill_paise": number | null,
"goal_plan": Database["public"]['Enums']["goal_plan"] | null,
"id": string,
"kind": Database["public"]['Enums']["kitty_kind"],
"organiser_id": string,
"parts_count": number | null,
"remind_day_before": boolean,
"remind_on_day": boolean,
"share_slug": string,
"shared_at": string | null,
"status": Database["public"]['Enums']["kitty_status"],
"title": string,
"total_paise": number,
"updated_at": string,
"upi_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "kitties"
        isOneToOne: true
        isSetofReturn: false
      } }
          }
          Enums: {
            "amount_source": "typed"|"scanned","bill_category": "veg"|"nonveg"|"alcohol"|"unsure","bill_status": "processing"|"needs_review"|"confirmed"|"failed","diet": "veg"|"nonveg","goal_plan": "single"|"parts","kitty_kind": "moment"|"goal","kitty_status": "draft"|"shared"|"settling"|"closed"|"cancelled","payment_direction": "in"|"out","payment_kind": "share"|"topup"|"refund"|"part","payment_status": "requested"|"marked"|"confirmed"|"not_received"|"written_off"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "amount_source": ["typed", "scanned"],"bill_category": ["veg", "nonveg", "alcohol", "unsure"],"bill_status": ["processing", "needs_review", "confirmed", "failed"],"diet": ["veg", "nonveg"],"goal_plan": ["single", "parts"],"kitty_kind": ["moment", "goal"],"kitty_status": ["draft", "shared", "settling", "closed", "cancelled"],"payment_direction": ["in", "out"],"payment_kind": ["share", "topup", "refund", "part"],"payment_status": ["requested", "marked", "confirmed", "not_received", "written_off"]
          }
        }
} as const
