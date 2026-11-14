using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Ampara.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Bo : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "BosRascunho",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    OcorrenciaId = table.Column<Guid>(type: "uuid", nullable: false),
                    GeradoEm = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    DelegaciaNome = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    TextoCifrado = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_BosRascunho", x => x.Id);
                    table.ForeignKey(
                        name: "FK_BosRascunho_Ocorrencias_OcorrenciaId",
                        column: x => x.OcorrenciaId,
                        principalTable: "Ocorrencias",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_BosRascunho_OcorrenciaId",
                table: "BosRascunho",
                column: "OcorrenciaId",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "BosRascunho");
        }
    }
}
