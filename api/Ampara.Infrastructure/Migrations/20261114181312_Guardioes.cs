using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ampara.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Guardioes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Convites",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UsuarioId = table.Column<Guid>(type: "uuid", nullable: false),
                    Codigo = table.Column<string>(type: "character varying(6)", maxLength: 6, nullable: false),
                    ExpiraEm = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UsadoEm = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Convites", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Convites_Usuarios_UsuarioId",
                        column: x => x.UsuarioId,
                        principalTable: "Usuarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Guardioes",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    UsuarioId = table.Column<Guid>(type: "uuid", nullable: false),
                    GuardiaoUsuarioId = table.Column<Guid>(type: "uuid", nullable: false),
                    Ordem = table.Column<int>(type: "integer", nullable: false),
                    CriadoEm = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Guardioes", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Guardioes_Usuarios_GuardiaoUsuarioId",
                        column: x => x.GuardiaoUsuarioId,
                        principalTable: "Usuarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Guardioes_Usuarios_UsuarioId",
                        column: x => x.UsuarioId,
                        principalTable: "Usuarios",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Convites_Codigo",
                table: "Convites",
                column: "Codigo",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Convites_UsuarioId",
                table: "Convites",
                column: "UsuarioId");

            migrationBuilder.CreateIndex(
                name: "IX_Guardioes_GuardiaoUsuarioId",
                table: "Guardioes",
                column: "GuardiaoUsuarioId");

            migrationBuilder.CreateIndex(
                name: "IX_Guardioes_UsuarioId_GuardiaoUsuarioId",
                table: "Guardioes",
                columns: new[] { "UsuarioId", "GuardiaoUsuarioId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Guardioes_UsuarioId_Ordem",
                table: "Guardioes",
                columns: new[] { "UsuarioId", "Ordem" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Convites");

            migrationBuilder.DropTable(
                name: "Guardioes");
        }
    }
}
